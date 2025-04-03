#!/usr/bin/env python3
import sys
import inspect
from moonraker_api import MoonrakerClient, MoonrakerListener

# Print the module path
print(f"moonraker_api module path: {sys.modules['moonraker_api'].__file__}")

# Get the source code of MoonrakerClient
try:
    print("\nMoonrakerClient definition:")
    print(inspect.getsource(MoonrakerClient))
except Exception as e:
    print(f"Error getting source: {e}")

# Look at the class attributes
print("\nMoonrakerClient attributes:")
for attr in dir(MoonrakerClient):
    if not attr.startswith('__'):
        print(f"  - {attr}")

# Create a client and inspect its initialization
host = "192.168.1.212:7125"
print(f"\nCreating client with host={host}")

listener = MoonrakerListener()
client = MoonrakerClient(host=host, listener=listener)

# Print the client attributes
print("\nClient instance attributes:")
for attr in dir(client):
    if not attr.startswith('__') and not callable(getattr(client, attr)):
        try:
            value = getattr(client, attr)
            print(f"  - {attr}: {value}")
        except Exception as e:
            print(f"  - {attr}: [Error: {e}]")

# Try to access the host directly
try:
    # If host is private, try to access through _host
    if hasattr(client, '_host'):
        print(f"\nClient _host: {client._host}")
    elif hasattr(client, 'host'):
        print(f"\nClient host: {client.host}")
    else:
        print("\nCould not find host attribute")
except Exception as e:
    print(f"Error accessing host: {e}")

# Try to debug the websocket URL generation
try:
    from moonraker_api.websockets.websocketclient import WebsocketClient
    print("\nWebsocketClient definition:")
    print(inspect.getsource(WebsocketClient))
except Exception as e:
    print(f"Error getting WebsocketClient source: {e}")

print("\nDone inspecting") 