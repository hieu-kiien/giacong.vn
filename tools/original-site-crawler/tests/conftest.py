import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
import time
import pytest

class MockScraperHTTPServer(HTTPServer):
    def __init__(self, server_address, RequestHandlerClass):
        super().__init__(server_address, RequestHandlerClass)
        self.request_counts = {}
        self.lock = threading.Lock()

class MockHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Suppress logging to keep pytest output clean
        pass

    def do_GET(self):
        path = self.path
        with self.server.lock:
            self.server.request_counts[path] = self.server.request_counts.get(path, 0) + 1
            count = self.server.request_counts[path]

        # Standard Headers
        headers = {
            "Content-Type": "text/html; charset=utf-8",
            "Server": "MockServer/1.0"
        }

        # HTML generation helper
        def make_html(title, body_content, body_class="", links=[]):
            links_html = "".join([f'<a href="{lnk}">Link to {lnk}</a>' for lnk in links])
            body_class_attr = f' class="{body_class}"' if body_class else ''
            return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{title}</title>
</head>
<body{body_class_attr}>
    {body_content}
    <div class="navigation">
        {links_html}
    </div>
</body>
</html>"""

        # Routing logic
        # Rate-limiting endpoints (429 / 503)
        if path == "/status/429":
            if count <= 2:
                self.send_response(429)
                self.send_header("Content-Type", "text/plain")
                self.send_header("Retry-After", "1")
                self.end_headers()
                self.wfile.write(b"Too Many Requests - Retry after 1s")
                return
            else:
                self.send_response(200)
                for k, v in headers.items():
                    self.send_header(k, v)
                self.end_headers()
                html = "<html><head><title>Succeed after 429</title></head><body><h1>Succeed after 429</h1><p>Content recovered from 429.</p></body></html>"
                self.wfile.write(html.encode("utf-8"))
                return

        elif path == "/status/503":
            if count <= 2:
                self.send_response(503)
                self.send_header("Content-Type", "text/plain")
                self.send_header("Retry-After", "1")
                self.end_headers()
                self.wfile.write(b"Service Unavailable")
                return
            else:
                self.send_response(200)
                for k, v in headers.items():
                    self.send_header(k, v)
                self.end_headers()
                html = "<html><head><title>Succeed after 503</title></head><body><h1>Succeed after 503</h1><p>Content recovered from 503.</p></body></html>"
                self.wfile.write(html.encode("utf-8"))
                return

        elif path == "/status/429-persistent":
            self.send_response(429)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"Persistent 429")
            return

        elif path == "/status/503-persistent":
            self.send_response(503)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"Persistent 503")
            return

        elif path == "/status/500":
            self.send_response(500)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"Internal Server Error")
            return

        # Network delay simulation
        elif path == "/timeout":
            time.sleep(2.0)
            self.send_response(200)
            for k, v in headers.items():
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(b"<html><head><title>Timeout Page</title></head><body><h1>Timeout</h1></body></html>")
            return

        # Redirection scenarios
        elif path == "/redirect/a":
            self.send_response(302)
            self.send_header("Location", "/redirect/b")
            self.end_headers()
            return
        elif path == "/redirect/b":
            self.send_response(302)
            self.send_header("Location", "/redirect/c")
            self.end_headers()
            return
        elif path == "/redirect/c":
            self.send_response(302)
            self.send_header("Location", "/redirect/a")
            self.end_headers()
            return
        elif path == "/redirect-to-contacts":
            self.send_response(302)
            self.send_header("Location", "/lien-he/")
            self.end_headers()
            return

        elif path == "/combo/backoff-lazy-contacts":
            if count <= 2:
                self.send_response(429)
                self.send_header("Content-Type", "text/plain")
                self.end_headers()
                self.wfile.write(b"Rate Limit")
                return
            else:
                self.send_response(200)
                for k, v in headers.items():
                    self.send_header(k, v)
                self.end_headers()
                html = make_html(
                    title="Combo Backoff Lazy Contacts",
                    body_content="""<h1>Combo success</h1>
                    <img data-src="/images/combo.jpg">
                    <p>Call 0947142999 or email info@giacong.vn</p>""",
                    body_class="dich-vu-gia-cong"
                )
                self.wfile.write(html.encode("utf-8"))
                return

        elif path == "/combo/normalized-429":
            if count <= 2:
                self.send_response(429)
                self.send_header("Content-Type", "text/plain")
                self.end_headers()
                self.wfile.write(b"Rate Limit")
                return
            else:
                self.send_response(200)
                for k, v in headers.items():
                    self.send_header(k, v)
                self.end_headers()
                html = make_html(
                    title="Normalized 429",
                    body_content="<h1>Normalized 429 success</h1>",
                    links=["/combo/normalized-429?replytocom=abc", "/"]
                )
                self.wfile.write(html.encode("utf-8"))
                return

        # Normal application paths
        self.send_response(200)
        
        # Override headers for specific encodings
        if path == "/iso-8859-1":
            headers["Content-Type"] = "text/html; charset=ISO-8859-1"
        
        for k, v in headers.items():
            self.send_header(k, v)
        self.end_headers()



        # Dispatch responses based on path
        if path == "/":
            html = make_html(
                title="Trang chủ - gia công",
                body_content="<h1>Gia Công Cơ Khí giacong.vn</h1><p>Chào mừng đến với hệ thống gia công chuyên nghiệp.</p>",
                links=["/san-pham/", "/dich-vu/", "/tin-tuc/", "/lien-he/", "/ve-chung-toi/"]
            )
        elif path == "/san-pham/":
            html = make_html(
                title="Sản phẩm gia công",
                body_content="<h1>Danh sách sản phẩm</h1><p>Chúng tôi gia công nhiều loại sản phẩm chất lượng cao.</p>",
                body_class="archive post-type-archive-product tax-product_cat",
                links=["/san-pham/sp1", "/san-pham/sp2"]
            )
        elif path == "/san-pham/sp1":
            html = make_html(
                title="Sản phẩm 1 - Gia công cơ khí",
                body_content="""<h1>Chi tiết sản phẩm 1</h1>
                <p>Mô tả chi tiết sản phẩm 1 ở đây.</p>
                <img data-src="/images/sp1_main.jpg" alt="Main image">
                <img class="lazy" data-lazy-src="/images/sp1_detail.jpg" alt="Detail image">""",
                body_class="single-product",
                links=["/san-pham/"]
            )
        elif path == "/san-pham/sp2":
            html = make_html(
                title="Sản phẩm 2 - Gia công cơ khí",
                body_content="""<h1>Chi tiết sản phẩm 2</h1>
                <p>Mô tả chi tiết sản phẩm 2 ở đây.</p>
                <img src="/images/sp2_normal.jpg" alt="Normal image">""",
                body_class="single-product",
                links=["/san-pham/"]
            )
        elif path == "/dich-vu/":
            html = make_html(
                title="Dịch vụ gia công",
                body_content="<h1>Dịch vụ tiện phay bào laser CNC</h1><p>Dịch vụ gia công cơ khí theo yêu cầu.</p>",
                links=["/"]
            )
        elif path == "/tin-tuc/":
            html = make_html(
                title="Tin tức cơ khí",
                body_content="<h1>Tin tức mới nhất</h1><p>Xu hướng công nghệ gia công cơ khí.</p>",
                body_class="category-tin-tuc",
                links=["/tin-tuc/post1"]
            )
        elif path == "/tin-tuc/post1":
            html = make_html(
                title="Bài viết 1 - Tin tức cơ khí",
                body_content="<h1>Cách chọn xưởng gia công uy tín</h1><p>Bài viết chia sẻ kinh nghiệm hữu ích.</p>",
                body_class="single-post",
                links=["/tin-tuc/"]
            )
        elif path == "/lien-he/":
            html = make_html(
                title="Liên hệ - gia công",
                body_content="""<h1>Thông tin liên hệ</h1>
                <p>Hotline: 0947142999</p>
                <p>Email: info@giacong.vn</p>
                <p>Địa chỉ: 123 Đường Gia Công, Quận 1, TP.HCM</p>""",
                links=["/"]
            )
        elif path == "/ve-chung-toi/":
            html = make_html(
                title="Về chúng tôi - Gia công",
                body_content="<h1>Về chúng tôi</h1><p>Giới thiệu công ty thành lập từ 2010.</p>",
                links=["/"]
            )
        elif path.startswith("/query-param"):
            html = make_html(
                title="Query Param Test",
                body_content="<h1>Query param page</h1>",
                links=["/query-param?replytocom=123", "/query-param?replytocom=456", "/"]
            )
        elif path == "/feed/":
            # XML feed - typically excluded, or categorized as "khác"
            html = "<rss><channel><title>Gia công RSS Feed</title></channel></rss>"
        elif path.startswith("/duplicate/"):
            html = make_html(
                title="Duplicate Test",
                body_content=f"<h1>Duplicate {path}</h1>",
                links=["/duplicate/a", "/duplicate/b"]
            )
        elif path == "/empty":
            html = ""
        elif path == "/large-html":
            # Generate a 5.1MB HTML page
            large_text = "Gia công cơ khí " * 350000
            html = make_html(
                title="Large HTML Page",
                body_content=f"<h1>Large HTML</h1><p>{large_text}</p>"
            )
        elif path == "/iso-8859-1":
            # Simple content encoding ISO-8859-1
            html = make_html(
                title="ISO Encodings",
                body_content="<h1>Tieu de bang ISO</h1><p>Noi dung tieng Viet khong dau: Gia cong co khi</p>"
            )
            self.wfile.write(html.encode("iso-8859-1"))
            return
        elif path == "/broken-lazy":
            html = make_html(
                title="Broken Lazy Images",
                body_content="""<h1>Broken Lazy load</h1>
                <img data-src="" alt="empty src">
                <img data-lazy-src="   " alt="whitespace src">
                <img alt="no src at all">"""
            )
        elif path == "/comments-contact":
            html = make_html(
                title="Contacts in HTML Comments",
                body_content="""<h1>Hidden contacts</h1>
                <!-- Hotline: 0947142999 -->
                <!-- Email: info@giacong.vn -->
                <!-- Địa chỉ: 123 Đường Gia Công, TP.HCM -->"""
            )
        elif path == "/fake-phone":
            html = make_html(
                title="Fake Phone Numbers",
                body_content="""<h1>Fake Phone</h1>
                <p>This is a string 0123-abc-456 that looks like a phone but is not.</p>
                <p>This is a long string 99999999999999999 that is too long.</p>"""
            )
        elif path == "/multiple-emails":
            html = make_html(
                title="Multiple Emails",
                body_content="""<h1>Multiple Emails</h1>
                <p>Contact us at feedback@giacong.vn, info@giacong.vn, or support@giacong.vn.</p>"""
            )
        elif path == "/nested-phone":
            html = make_html(
                title="Nested Phone Tags",
                body_content="""<h1>Nested Phone</h1>
                <p>Phone: <span>0947</span><span>142</span><span>999</span></p>"""
            )
        elif path == "/malformed-html":
            html = """<html>
            <head><title>Malformed HTML Page</title>
            <body>
            <h1>Malformed HTML</h1>
            <p>Missing close tags.
            <div><span>Unclosed nested tags
            <a href="/lien-he/">Link to contact
            </body>
            """
        elif path == "/woocommerce-dom":
            html = make_html(
                title="WooCommerce Item",
                body_content="<h1>Chi tiết sản phẩm</h1>",
                body_class="product-template-default single single-product postid-100 woocommerce"
            )
        # Combinations
        elif path == "/combo/slow-depth-crawl":
            time.sleep(0.5)
            html = make_html(
                title="Slow depth 1",
                body_content="<h1>Slow depth 1</h1>",
                links=["/combo/slow-depth-crawl-deep"]
            )
        elif path == "/combo/slow-depth-crawl-deep":
            time.sleep(0.5)
            html = make_html(
                title="Slow depth 2",
                body_content="<h1>Slow depth 2</h1>",
                links=["/"]
            )
        # Fallback
        else:
            self.send_response(404)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"Not Found")
            return

        self.wfile.write(html.encode("utf-8"))


@pytest.fixture(scope="session")
def mock_server():
    # Bind to 127.0.0.1 and port 0 (OS will select a free port)
    server = MockScraperHTTPServer(('127.0.0.1', 0), MockHandler)
    ip, port = server.server_address
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    url = f"http://{ip}:{port}"
    yield url
    server.shutdown()
    server.server_close()
