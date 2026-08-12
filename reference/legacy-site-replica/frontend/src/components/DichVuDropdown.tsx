import React from 'react';
import Link from 'next/link';

interface DropdownProps {
  isActive: boolean;
}

export default function DichVuDropdown({ isActive }: DropdownProps) {
  const dropdownStyle: React.CSSProperties = {
    display: isActive ? 'block' : 'none',
    opacity: isActive ? '1' : '0',
    visibility: isActive ? 'visible' : 'hidden',
  };

  return (
    <div
      className={`sub-menu nav-dropdown ${isActive ? 'nav-dropdown-active show' : ''}`}
      style={dropdownStyle}
    >
      <div className="row row-small menu-san-pham" id="row-1595825502">
        <div id="col-1028178647" className="col medium-3 small-6 large-3">
          <div className="col-inner">
            <h4><Link href="/dich-vu-say">Dịch vụ sấy</Link></h4>
            <div className="ux-menu stack stack-col justify-start ux-menu--divider-solid">
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/say-thang-hoa">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Sấy thăng hoa</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/say-nong">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Sấy nóng</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/say-lanh">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Sấy lạnh</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/say-chan-khong">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Sấy chân không</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/say-hong-ngoai">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Sấy hồng ngoại</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div id="col-215179221" className="col medium-3 small-6 large-3">
          <div className="col-inner">
            <h4><Link href="/gia-cong-do-uong">Gia công đồ uống</Link></h4>
            <div className="ux-menu stack stack-col justify-start ux-menu--divider-solid">
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/gia-cong-sua-hat">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Gia công sữa hạt</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/gia-cong-sua-thuc-vat">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Gia công sữa thực vật</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/gia-cong-nuoc-ep-trai-cay">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Gia công nước ép trái cây</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/gia-cong-nuoc-giai-khat-co-ga">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Gia công nước giải khát</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/gia-cong-tra-dong-chai">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Gia công trà đóng chai</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/gia-cong-nuoc-uong-dong-chai">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Gia công nước lọc</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/gia-cong-ca-phe-qua-tang">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Gia công cà phê quà tặng</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/gia-cong-ca-phe-hoa-tan">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Gia công cà phê hòa tan</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/gia-cong-tra-tui-loc">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Gia công trà túi lọc</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/rang-gia-cong-ca-phe">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Gia công rang cà phê</span>
                </Link>
              </div>
            </div>

            <h4><Link href="/dich-vu-dong-goi">Dịch vụ đóng gói</Link></h4>
            <div className="ux-menu stack stack-col justify-start ux-menu--divider-solid">
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/dich-vu-say-mit">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Mit sấy</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/dich-vu-say-hong">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Hồng sấy</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/dich-vu-say-khoai-lang">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Khoai lang sấy</span>
                </Link>
              </div>
            </div>

            <h4><Link href="/dich-vu-thiet-ke">Dịch vụ thiết kế</Link></h4>
            <div className="ux-menu stack stack-col justify-start ux-menu--divider-solid">
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="#" onClick={(e) => e.preventDefault()}>
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Thiết kế bao bì</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="#" onClick={(e) => e.preventDefault()}>
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Thiết kế chai lọ</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="#" onClick={(e) => e.preventDefault()}>
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Thiết kế logo</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div id="col-1264614639" className="col medium-3 small-6 large-3">
          <div className="col-inner">
            <h4><Link href="/dich-vu-phap-ly">Dịch vụ pháp lý</Link></h4>
            <div className="ux-menu stack stack-col justify-start ux-menu--divider-solid">
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="#" onClick={(e) => e.preventDefault()}>
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Đăng ký công bố sản phẩm</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="#" onClick={(e) => e.preventDefault()}>
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Đăng ký bảo hộ thương hiệu</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="#" onClick={(e) => e.preventDefault()}>
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Đăng ký mã vạch</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div id="col-1690191364" className="col medium-3 small-6 large-3">
          <div className="col-inner">
            <h4><Link href="/dich-vu-marketing">Dịch vụ marketing</Link></h4>
            <div className="ux-menu stack stack-col justify-start ux-menu--divider-solid">
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="#" onClick={(e) => e.preventDefault()}>
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Marketing trọn gói</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="#" onClick={(e) => e.preventDefault()}>
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Quản trị Fanpage</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="#" onClick={(e) => e.preventDefault()}>
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Quảng cáo trực tuyến</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
