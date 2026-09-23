// Prey Lock — GNOME Shell extension.
//
// WHY THIS EXISTS: on GNOME Wayland, Mutter does not expose ext-session-lock-v1
// to unprivileged clients, so a binary launched by Prey as the logged-in user
// cannot build an inescapable lock. This extension runs inside gnome-shell (the
// compositor process), so it CAN: it takes a full input grab (Main.pushModal
// with ActionMode.NONE, which disables every shell keybinding — Alt+Tab, Super,
// Alt+F2, the overview) and paints a lock surface on every monitor.
//
// The prey-lock-gtk4 binary stays the entry point. It drives this extension over
// the session bus (com.preyproject.PreyLock) and never sees the typed password:
// the md5(base64(pw)) check runs here, so the plaintext never leaves gnome-shell.
//
// Contract mirrored from the binary/Node side:
//   * signal Unlocked        -> binary exits 66 (correct password)
//   * signal InvalidAttempt  -> binary prints "Invalid password" (failed attempt)
//   * caller dies on the bus  -> auto-unlock (matches Node's kill-to-unlock model)
//
// AUTHORIZATION: the lock is "owned" by the unique bus name that armed it
// (this._sender, captured in LockAsync). While a lock is active, Lock() (re-arm)
// and Unlock() over D-Bus are honored ONLY from that same sender; any other
// session-bus peer is rejected. This is not a defense against a process running
// as the logged-in user — such a process can already drop the lock by killing
// the driver (the sender-death auto-unlock above) and read the armed hash from
// the runtime state file. It exists to stop an *unrelated* bus peer from force-
// unlocking or overwriting the armed hash. See CONTEXT.md "Modelo de amenaza".

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const BUS_NAME = 'com.preyproject.PreyLock';
const OBJECT_PATH = '/com/preyproject/PreyLock';
const PROTOCOL_VERSION = 1;

const IFACE_XML = `
<node>
  <interface name="com.preyproject.PreyLock1">
    <method name="Lock">
      <arg type="s" direction="in" name="hash"/>
      <arg type="s" direction="in" name="message"/>
      <arg type="b" direction="out" name="started"/>
    </method>
    <method name="Unlock"/>
    <method name="GetState">
      <arg type="b" direction="out" name="locked"/>
    </method>
    <signal name="InvalidAttempt"/>
    <signal name="Unlocked"/>
    <property name="Version" type="u" access="read"/>
  </interface>
</node>`;

// md5(base64(password)) -> lowercase hex. Must match prey::create_md5_hash in
// src/hash.hpp exactly: base64-encode the raw password bytes (no newlines), then
// MD5 that base64 string. GLib.base64_encode never inserts newlines, matching
// BIO_FLAGS_BASE64_NO_NL on the C++ side.
function computeHash(password) {
    const b64 = GLib.base64_encode(new TextEncoder().encode(password));
    return GLib.compute_checksum_for_string(GLib.ChecksumType.MD5, b64, -1);
}

function log(msg) {
    console.log(`[prey-lock] ${msg}`);
}

// Version-agnostic check that a Main.pushModal() result actually took the grab.
// The return type has changed across GNOME versions:
//   * GNOME <= 3.36: pushModal returns a boolean.
//   * GNOME 42+: returns a Clutter.Grab. Some versions expose get_seat_state()
//     (compare against Clutter.GrabState.ALL); others do not expose it at all —
//     calling it throws "get_seat_state is not a function". In that case a truthy
//     grab means the modal was taken.
function grabIsActive(grab) {
    if (typeof grab === 'boolean')
        return grab;
    if (!grab)
        return false;
    if (typeof grab.get_seat_state === 'function' && Clutter.GrabState)
        return grab.get_seat_state() === Clutter.GrabState.ALL;
    return true;
}

// St.BoxLayout switched from the `vertical` boolean to the `orientation` enum in
// GNOME 48. Try the modern property first and fall back so one extension.js
// works across shell 45–50.
function makeVBox(params = {}) {
    try {
        return new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, ...params});
    } catch (_e) {
        return new St.BoxLayout({vertical: true, ...params});
    }
}

// Owns the on-screen actors and the input grab. Independent of the D-Bus glue so
// the lock lifecycle is easy to follow.
class LockUI {
    constructor(ext) {
        this._ext = ext;
        this._overlay = null;
        this._grab = null;
        this._entry = null;
        this._error = null;
        this._message = '';
        this._monitorsId = 0;
        this._grabRetryId = 0;
    }

    get active() {
        return this._overlay !== null;
    }

    // Show (or, if already up, just refresh the message). Returns true when the
    // lock is armed or a grab retry is pending.
    show(message) {
        this._message = message || '';
        if (this._overlay) {
            this._rebuildMonitors();
            return true;
        }
        this._overlay = new St.Widget({
            style_class: 'prey-lock-overlay',
            reactive: true,
            can_focus: true,
        });
        Main.layoutManager.addTopChrome(this._overlay);
        this._overlay.connect('key-press-event', (_a, ev) => this._onKeyPress(ev));
        this._monitorsId = Main.layoutManager.connect(
            'monitors-changed', () => this._rebuildMonitors());
        this._rebuildMonitors();
        return this._pushModal();
    }

    hide() {
        if (this._grabRetryId) {
            GLib.source_remove(this._grabRetryId);
            this._grabRetryId = 0;
        }
        if (this._grab) {
            Main.popModal(this._grab);
            this._grab = null;
        }
        if (this._monitorsId) {
            Main.layoutManager.disconnect(this._monitorsId);
            this._monitorsId = 0;
        }
        if (this._overlay) {
            this._overlay.destroy();
            this._overlay = null;
        }
        this._entry = null;
        this._error = null;
    }

    showError(text) {
        if (this._error)
            this._error.set_text(text);
        if (this._entry)
            this._entry.set_text('');
    }

    _rebuildMonitors() {
        if (!this._overlay)
            return;
        this._overlay.destroy_all_children();
        this._entry = null;
        this._error = null;

        const monitors = Main.layoutManager.monitors;
        // Bounding box over all monitors so the overlay covers the whole layout
        // even with negative offsets or gaps.
        let minX = 0, minY = 0, maxX = 0, maxY = 0;
        for (const m of monitors) {
            minX = Math.min(minX, m.x);
            minY = Math.min(minY, m.y);
            maxX = Math.max(maxX, m.x + m.width);
            maxY = Math.max(maxY, m.y + m.height);
        }
        this._overlay.set_position(minX, minY);
        this._overlay.set_size(maxX - minX, maxY - minY);

        const primaryIndex = Main.layoutManager.primaryIndex;
        monitors.forEach((m, i) => {
            const pane = new St.Widget({
                style_class: 'prey-lock-pane',
                x: m.x - minX,
                y: m.y - minY,
                width: m.width,
                height: m.height,
                layout_manager: new Clutter.BinLayout(),
            });
            if (i === primaryIndex)
                pane.add_child(this._buildPrimaryContent());
            this._overlay.add_child(pane);
        });

        if (this._entry)
            global.stage.set_key_focus(this._entry.clutter_text);
    }

    _buildPrimaryContent() {
        const box = makeVBox({
            style_class: 'prey-lock-box',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });

        // Aspect-preserving logo (native 324x186). St.Icon would force a square
        // and squash it, so use a Bin whose background-image is sized in CSS with
        // background-size: contain (the St equivalent of GTK's ContentFit::CONTAIN).
        const logo = new St.Bin({style_class: 'prey-lock-logo'});
        box.add_child(logo);

        // Custom message from Prey (optional).
        if (this._message) {
            const msg = new St.Label({
                text: this._message,
                style_class: 'prey-lock-message',
            });
            msg.clutter_text.line_wrap = true;
            box.add_child(msg);
        }

        // Always-present, high-contrast instruction.
        const instruction = new St.Label({
            text: 'Enter your password to unlock',
            style_class: 'prey-lock-instruction',
        });
        box.add_child(instruction);

        this._entry = new St.PasswordEntry({
            style_class: 'prey-lock-entry',
            can_focus: true,
            hint_text: 'Password',
            show_peek_icon: false,  // no reveal button on a lock screen
            x_align: Clutter.ActorAlign.CENTER,
        });
        this._entry.clutter_text.connect(
            'activate', () => this._ext.onSubmit(this._entry.get_text()));
        box.add_child(this._entry);

        this._error = new St.Label({text: '', style_class: 'prey-lock-error'});
        box.add_child(this._error);

        return box;
    }

    // What to hand back to Main.popModal(): the Clutter.Grab (GNOME 42+) or, on
    // the legacy boolean API, the actor itself.
    _grabHandle(grab) {
        return (grab && typeof grab !== 'boolean') ? grab : this._overlay;
    }

    _pushModal() {
        const grab = Main.pushModal(this._overlay,
            {actionMode: Shell.ActionMode.NONE});
        if (grabIsActive(grab)) {
            this._grab = this._grabHandle(grab);
            if (this._entry)
                global.stage.set_key_focus(this._entry.clutter_text);
            log('modal grab acquired');
            return true;
        }
        // Another grab (an open menu, a transition) blocked us. Drop this one and
        // retry until we own the seat.
        log('modal grab not ready, will retry');
        Main.popModal(this._grabHandle(grab));
        if (!this._grabRetryId) {
            this._grabRetryId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT, 250, () => {
                    if (!this._overlay) {
                        this._grabRetryId = 0;
                        return GLib.SOURCE_REMOVE;
                    }
                    const g = Main.pushModal(this._overlay,
                        {actionMode: Shell.ActionMode.NONE});
                    if (!grabIsActive(g)) {
                        Main.popModal(this._grabHandle(g));
                        return GLib.SOURCE_CONTINUE;
                    }
                    this._grab = this._grabHandle(g);
                    if (this._entry)
                        global.stage.set_key_focus(this._entry.clutter_text);
                    this._grabRetryId = 0;
                    log('modal grab acquired (retry)');
                    return GLib.SOURCE_REMOVE;
                });
        }
        return true;
    }

    _onKeyPress(event) {
        // Swallow Escape so it can never dismiss the lock; everything else flows
        // to the focused password entry.
        if (event.get_key_symbol() === Clutter.KEY_Escape)
            return Clutter.EVENT_STOP;
        return Clutter.EVENT_PROPAGATE;
    }
}

export default class PreyLockExtension extends Extension {
    enable() {
        this._locked = false;
        this._hash = null;
        this._message = '';
        this._sender = null;
        this._senderWatchId = 0;
        this._ui = new LockUI(this);

        this._dbusImpl = Gio.DBusExportedObject.wrapJSObject(IFACE_XML, this);
        this._dbusImpl.export(Gio.DBus.session, OBJECT_PATH);
        this._nameId = Gio.bus_own_name(
            Gio.BusType.SESSION, BUS_NAME, Gio.BusNameOwnerFlags.REPLACE,
            null, null, null);

        // On an X11 shell restart the extension is re-enabled; re-assert the lock
        // if one was active. (On Wayland the whole session dies with the shell, so
        // there is nothing to restore — the state file is simply absent.)
        this._restoreState();
    }

    disable() {
        // Release the grab and tear down actors, but KEEP the persisted state so
        // an X11 shell restart re-locks. State is cleared only on real Unlock.
        this._clearSenderWatch();
        if (this._nameId) {
            Gio.bus_unown_name(this._nameId);
            this._nameId = 0;
        }
        if (this._dbusImpl) {
            this._dbusImpl.unexport();
            this._dbusImpl = null;
        }
        if (this._ui) {
            this._ui.hide();
            this._ui = null;
        }
    }

    // ---- D-Bus methods (wrapJSObject dispatches to these) ----

    // Async form so we can read the caller's unique bus name and watch it.
    LockAsync(params, invocation) {
        const [hash, message] = params;
        const caller = invocation.get_sender();
        log(`Lock invoked (hash len ${hash ? hash.length : 0})`);
        // While a lock is active, only the sender that armed it may re-arm it;
        // reject any other peer so it cannot overwrite the armed hash/message.
        if (this._locked && this._sender && caller !== this._sender) {
            log('Lock refused: caller is not the lock owner');
            invocation.return_value(new GLib.Variant('(b)', [false]));
            return;
        }
        this._sender = caller;
        this._watchSender(this._sender);
        let started = false;
        try {
            started = this._doLock(hash, message);
        } catch (e) {
            logError(e, '[prey-lock] Lock failed');
        }
        invocation.return_value(new GLib.Variant('(b)', [started]));
    }

    UnlockAsync(params, invocation) {
        const caller = invocation.get_sender();
        // Honor D-Bus Unlock only from the sender that armed the lock. When
        // _sender is null the lock was restored after an X11 shell restart with
        // no known owner; allow the unlock then rather than risk wedging the
        // machine (brief, rare window). The UI password path is unaffected.
        if (this._sender && caller !== this._sender) {
            log('Unlock refused: caller is not the lock owner');
        } else {
            this._doUnlock();
        }
        invocation.return_value(null);
    }

    GetState() {
        return this._locked;
    }

    get Version() {
        return PROTOCOL_VERSION;
    }

    // ---- Internal lock lifecycle ----

    onSubmit(text) {
        const ok = this._hash && computeHash(text) === this._hash;
        if (ok) {
            this._doUnlock();
            if (this._dbusImpl)
                this._dbusImpl.emit_signal('Unlocked', null);
            return;
        }
        if (this._dbusImpl)
            this._dbusImpl.emit_signal('InvalidAttempt', null);
        if (this._ui)
            this._ui.showError('Incorrect password');
    }

    _doLock(hash, message) {
        this._hash = hash;
        this._message = message || '';
        this._locked = true;
        this._persistState(hash, this._message);
        return this._ui ? this._ui.show(this._message) : false;
    }

    _doUnlock() {
        log('unlocking');
        this._locked = false;
        this._hash = null;
        this._clearState();
        this._clearSenderWatch();
        if (this._ui)
            this._ui.hide();
    }

    // ---- Caller liveness watch ----

    _watchSender(name) {
        this._clearSenderWatch();
        this._senderWatchId = Gio.bus_watch_name(
            Gio.BusType.SESSION, name, Gio.BusNameWatcherFlags.NONE,
            null,
            () => {
                // The driving binary died without unlocking: release the lock,
                // mirroring Node's "kill the process to drop the lock" model.
                this._doUnlock();
            });
    }

    _clearSenderWatch() {
        if (this._senderWatchId) {
            Gio.bus_unwatch_name(this._senderWatchId);
            this._senderWatchId = 0;
        }
        this._sender = null;
    }

    // ---- State persistence (X11 shell-restart survival) ----

    _stateFile() {
        const dir = GLib.getenv('XDG_RUNTIME_DIR') || GLib.get_user_runtime_dir();
        return GLib.build_filenamev([dir, 'prey-lock.state']);
    }

    _persistState(hash, message) {
        try {
            GLib.file_set_contents(
                this._stateFile(), JSON.stringify({hash, message}));
        } catch (_e) {
            // Best-effort; losing this only weakens X11 restart survival.
        }
    }

    _clearState() {
        try {
            GLib.unlink(this._stateFile());
        } catch (_e) {}
    }

    _restoreState() {
        try {
            const [ok, contents] = GLib.file_get_contents(this._stateFile());
            if (!ok)
                return;
            const s = JSON.parse(new TextDecoder().decode(contents));
            if (s && s.hash)
                this._doLock(s.hash, s.message || '');
        } catch (_e) {}
    }
}
