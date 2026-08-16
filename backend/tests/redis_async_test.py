import asyncio

import redis.asyncio as redis


async def main():
    print("START")

    client = redis.Redis(
        host="127.0.0.1",
        port=6379,
        decode_responses=True,
        socket_connect_timeout=3,
    )

    print("CLIENT CREATED")

    result = await client.ping()

    print("PING RESULT:", result)

    await client.aclose()

    print("CLOSED")


asyncio.run(main())