import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-300 py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <span className="text-2xl font-black tracking-tight text-white">2Grils.PPT</span>
            <p className="text-sm text-slate-400">
              Nền tảng thương mại điện tử cung cấp template PowerPoint cao cấp và dịch vụ thiết kế chuyên nghiệp.
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold text-white mb-4">Sản phẩm</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/templates" className="hover:text-primary transition-colors">Tất cả Template</Link></li>
              <li><Link href="/templates?sort=best-seller" className="hover:text-primary transition-colors">Bán chạy nhất</Link></li>
              <li><Link href="/custom-design" className="hover:text-primary transition-colors">Thiết kế riêng</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-4">Hỗ trợ</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/faq" className="hover:text-primary transition-colors">FAQ</Link></li>
              <li><Link href="/terms" className="hover:text-primary transition-colors">Điều khoản sử dụng</Link></li>
              <li><Link href="/privacy" className="hover:text-primary transition-colors">Chính sách bảo mật</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-4">Kết nối</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-primary transition-colors">Facebook</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Instagram</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">LinkedIn</a></li>
            </ul>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t border-slate-800 text-center text-sm text-slate-500">
          <p>&copy; {new Date().getFullYear()} 2Grils.PPT. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
