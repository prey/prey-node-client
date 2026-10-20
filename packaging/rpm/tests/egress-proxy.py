#!/usr/bin/env python3
import asyncio
import ipaddress
import socket
import sys
import urllib.parse

USAGE = 'usage: egress-proxy.py <bind-address> <client-address> [port]'
TIMEOUT = 30
ALLOWED_PORTS = (80, 443)


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


async def open_public(host, port):
    if port not in ALLOWED_PORTS:
        raise PermissionError(f'port {port} not allowed')
    infos = await asyncio.get_running_loop().getaddrinfo(host, port, type=socket.SOCK_STREAM)
    addresses = [info[4][0] for info in infos]
    if not addresses or not all(ipaddress.ip_address(a).is_global for a in addresses):
        raise PermissionError(f'{host} does not resolve to public addresses only')
    return await asyncio.wait_for(asyncio.open_connection(addresses[0], port), TIMEOUT)


def make_handler(client):
    async def handle(creader, cwriter):
        peer = cwriter.get_extra_info('peername')
        if not peer or peer[0] != client:
            cwriter.close()
            return
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
                sreader, swriter = await open_public(host.strip('[]'), int(port))
                cwriter.write(b'HTTP/1.1 200 Connection established\r\n\r\n')
                await cwriter.drain()
            else:
                url = urllib.parse.urlsplit(target)
                if url.scheme != 'http' or not url.hostname:
                    await reply(cwriter, b'400 Bad Request', b'absolute http:// URI required\n')
                    return
                sreader, swriter = await open_public(url.hostname, url.port or 80)
                path = urllib.parse.urlunsplit(('', '', url.path or '/', url.query, ''))
                hop = (b'proxy-connection:', b'connection:', b'keep-alive:', b'proxy-authorization:')
                out = [f'{method} {path} {version}'.encode('latin1')]
                out += [h for h in lines[1:] if h and not h.lower().startswith(hop)]
                out += [b'Connection: close', b'', b'']
                swriter.write(b'\r\n'.join(out))
                await swriter.drain()
            print(f'{method} {target}', file=sys.stderr, flush=True)
        except Exception as exc:
            print(f'{method} {target} FAILED: {exc}', file=sys.stderr, flush=True)
            await reply(cwriter, b'502 Bad Gateway', f'{exc}\n'.encode())
            return
        await asyncio.gather(pipe(creader, swriter), pipe(sreader, cwriter))
    return handle


async def main():
    if len(sys.argv) < 3:
        sys.exit(USAGE)
    addr, client = sys.argv[1], sys.argv[2]
    port = int(sys.argv[3]) if len(sys.argv) > 3 else 0
    server = await asyncio.start_server(make_handler(client), addr, port)
    real_port = server.sockets[0].getsockname()[1]
    print(f'LISTENING {addr} {real_port}', flush=True)
    async with server:
        await server.serve_forever()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
