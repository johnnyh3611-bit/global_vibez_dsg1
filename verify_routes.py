from server import app

print("Checking registered routes:")
for route in app.routes:
    if hasattr(route, "path"):
        print(f"Path: {route.path} | Methods: {route.methods}")
