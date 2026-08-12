import http.server
import socketserver
import webbrowser
import threading
import time
import os

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def open_browser():
    # Wait a brief moment for the server to spin up
    time.sleep(1.0)
    url = f"http://localhost:{PORT}/preview.html"
    print(f"Opening browser to {url}...")
    webbrowser.open(url)

def main():
    # Allow port reuse to avoid 'Address already in use' errors on quick restarts
    socketserver.TCPServer.allow_reuse_address = True
    
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Server serving directory '{DIRECTORY}' on port {PORT}")
        
        # Start browser open thread
        t = threading.Thread(target=open_browser)
        t.daemon = True
        t.start()
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")
            httpd.shutdown()

if __name__ == "__main__":
    main()
