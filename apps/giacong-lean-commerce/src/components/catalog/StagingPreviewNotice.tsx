interface StagingPreviewNoticeProps {
  className?: string;
}

export function StagingPreviewNotice({ className = "" }: StagingPreviewNoticeProps) {
  return (
    <aside
      className={`rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950 ${className}`}
      data-staging-preview-notice
      role="note"
    >
      <strong className="font-semibold">Bản xem thử staging.</strong>{" "}
      Nội dung, giá, quy cách, số lượng tối thiểu, thời gian và thông số trên staging là dữ liệu demo; khách có thể chỉnh trong admin. Vui lòng xác nhận trước khi áp dụng thực tế.
    </aside>
  );
}
