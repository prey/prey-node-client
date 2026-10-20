#!/usr/bin/env python3
"""Tiny HTTP/HTTPS (CONNECT) forward proxy for the container tests.

Used by run-container-tests.sh only when containers on the docker bridge have no
egress (e.g. the host has net.ipv4.ip_forward=0 and we can't/won't fix it without
root). It must be bound to the docker bridge gateway address (e.g. 172.17.0.1) so
it is reachable from containers but not exposed on the LAN.

Usage: egress-proxy.py <bind-address> [port]   (port 0/omitted = ephemeral)
Prints "LISTENING <addr> <port>" on stdout once ready; logs one line per
connection on stderr.
"""
import asyncio
import sys
import urllib.parse

TIMEOUT = 30


async def pipe(reader, writer):
    try:
        while True:
            data = await reader.read(65536)
            if not data:
                break
            writer.write(data)
            await writer.drain()
    except Exception:
        pass
    finally:
        try:
            writer.close()
        except Exception:
            pass


async def reply(writer, status, body=b''):
    writer.write(b'HTTP/1.1 ' + status + b'\r\nConnection: close\r\nContent-Length: '
                 + str(len(body)).encode() + b'\r\n\r\n' + body)
    try:
        await writer.drain()
    finally:
        writer.close()


async def handle(creader, cwriter):
    try:
        head = await asyncio.wait_for(creader.readuntil(b'\r\n\r\n'), TIMEOUT)
    except Exception:
        cwriter.close()
        return
    lines = head.split(b'\r\n')
    try:
        method, target, version = lines[0].decode('latin1').split(' ', 2)
    except ValueError:
        await reply(cwriter, b'400 Bad Request')
        return
    try:
        if method.upper() == 'CONNECT':
            host, _, port = target.rpartition(':')
            host = host.strip('[]')
            sreader, swriter = await asyncio.wait_for(asyncio.open_connection(host, int(port)), TIMEOUT)
            cwriter.write(b'HTTP/1.1 200 Connection established\r\n\r\n')
            await cwriter.drain()
        else:
            url = urllib.parse.urlsplit(target)
            if url.scheme != 'http' or not url.hostname:
                await reply(cwriter, b'400 Bad Request', b'absolute http:// URI required\n')
                return
            sreader, swriter = await asyncio.wait_for(
                asyncio.open_connection(url.hostname, url.port or 80), TIMEOUT)
            path = urllib.parse.urlunsplit(('', '', url.path or '/', url.query, ''))
            hop = (b'proxy-connection:', b'connection:', b'keep-alive:', b'proxy-authorization:')
            out = [f'{method} {path} {version}'.encode('latin1')]
            out += [h for h in lines[1:] if h and not h.lower().startswith(hop)]
            out += [b'Connection: close', b'', b'']
            swriter.write(b'\r\n'.join(out))
            await swriter.drain()
        print(f'{method} {target}', file=sys.stderr, flush=True)
    except Exception as exc:  # DNS failure, refused, timeout...
        print(f'{method} {target} FAILED: {exc}', file=sys.stderr, flush=True)
        await reply(cwriter, b'502 Bad Gateway', f'{exc}\n'.encode())
        return
    await asyncio.gather(pipe(creader, swriter), pipe(sreader, cwriter))


async def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    addr = sys.argv[1]
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    server = await asyncio.start_server(handle, addr, port)
    real_port = server.sockets[0].getsockname()[1]
    print(f'LISTENING {addr} {real_port}', flush=True)
    async with server:
        await server.serve_forever()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
