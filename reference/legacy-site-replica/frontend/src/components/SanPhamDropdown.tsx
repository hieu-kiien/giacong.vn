import React from 'react';
import Link from 'next/link';

interface DropdownProps {
  isActive: boolean;
}

export default function SanPhamDropdown({ isActive }: DropdownProps) {
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
      <div className="row row-small menu-san-pham" id="row-1490213718">
        <div id="col-313507480" className="col medium-3 small-6 large-3">
          <div className="col-inner">
            <h4><Link href="/gia-cong-sot-cham">Gia công sốt chấm</Link></h4>
            <h4><Link href="/gia-cong-do-uong">Gia công đồ uống</Link></h4>
            <h4><Link href="/gia-cong-bot-pha-che">Gia công bột pha chế</Link></h4>
            <h4><Link href="/gia-cong-do-uong">Gia công đồ uống</Link></h4>
            <h4><Link href="/gia-cong-duoc-lieu">Gia công dược liệu</Link></h4>
            <h4><Link href="/gia-cong-thuc-pham">Gia công thực phẩm</Link></h4>
            <h4><Link href="/gia-cong-my-pham">Gia công mỹ phẩm</Link></h4>
            <h4><Link href="/gia-cong-tra">Gia công trà</Link></h4>
            <h4><Link href="/gia-cong-ca-phe">Gia công cà phê</Link></h4>
            <h4><Link href="/gia-cong-dong-goi">Gia công đóng gói</Link></h4>
            <h4><Link href="/gia-cong-bot">Gia công bột</Link></h4>
            <h4><Link href="/gia-cong-ruou">Gia công rượu</Link></h4>
            <p></p>
            <div className="ux-menu stack stack-col justify-start ux-menu--divider-solid"></div>
          </div>
        </div>

        <div id="col-824709395" className="col medium-3 small-6 large-3">
          <div className="col-inner">
            <h4><Link href="/gia-cong-sua">Gia công sữa</Link></h4>
            <div className="ux-menu stack stack-col justify-start ux-menu--divider-solid">
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/gia-cong-sua-bot">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Gia công sữa bột</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/gia-cong-sua-tuoi">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Gia công sữa tươi</span>
                </Link>
              </div>
            </div>

            <h4><Link href="/dich-vu-say">Dịch vụ sấy</Link></h4>
            <div className="ux-menu stack stack-col justify-start ux-menu--divider-solid">
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/say-thang-hoa">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Sấy thăng hoa</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/say-lanh">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Dịch vụ sấy lạnh</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/say-chan-khong">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Dịch vụ sấy chân không</span>
                </Link>
              </div>
            </div>

            <h4><Link href="/nuoc-trai-cay">Nước trái cây</Link></h4>
            <div className="ux-menu stack stack-col justify-start ux-menu--divider-solid">
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/gia-cong-nuoc-ep-chanh-leo">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Nước ép chanh leo</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/gia-cong-nuoc-ep-dua-hau">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Nước ép dưa hấu</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/gia-cong-nuoc-ep-dua">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Nước ép dứa</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div id="col-511078344" className="col medium-3 small-6 large-3">
          <div className="col-inner">
            <h4><Link href="/thuc-pham-say">Thực phẩm sấy</Link></h4>
            <div className="ux-menu stack stack-col justify-start ux-menu--divider-solid">
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Bột phô mai tách muối</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/sua-chua-say-thang-hoa">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Sữa chua vị việt quất</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/sua-chua-say-thang-hoa">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Sữa chua vị chuối</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/sua-chua-say-thang-hoa">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Sữa chua vị dâu tây</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/sua-chua-say-thang-hoa">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Sữa chua vị đào</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/sua-chua-say-thang-hoa">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Sữa chua vị nguyên bản</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/sua-chua-say-thang-hoa">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Sữa chua vị truyền thống</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div id="col-47526406" className="col medium-3 small-6 large-3">
          <div className="col-inner">
            <h4><Link href="/bot-gia-vi">Bột gia vị</Link></h4>
            <div className="ux-menu stack stack-col justify-start ux-menu--divider-solid">
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/gia-cong-bot-cu-gung">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Bột gừng</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/gia-cong-bot-hanh-tim">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Bột hành</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/gia-cong-bot-hanh-baro">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Bột Hành Baro</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/gia-cong-bot-hanh-tay">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Bột hành tây</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/gia-cong-bot-nghe">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Bột nghệ</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/gia-cong-ot-bot">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Bột ớt</span>
                </Link>
              </div>
              <div className="ux-menu-link flex menu-item">
                <Link className="ux-menu-link__link flex" href="/gia-cong-bot-cu-sa">
                  <i className="ux-menu-link__icon text-center icon-angle-right"></i>
                  <span className="ux-menu-link__text">Bột sả</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
