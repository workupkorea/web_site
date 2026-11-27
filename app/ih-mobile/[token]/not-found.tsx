export default function IHMobileNotFound() {
  return (
    <div className="w-full h-full flex items-center justify-center px-6">
      <div className="text-center">
        <p className="text-[16px] font-bold text-slate-900">접근 권한이 없습니다</p>
        <p className="mt-1.5 text-[13.5px] text-slate-500">
          링크가 잘못되었거나 만료되었습니다. 관리자에게 새 링크를 요청해주세요.
        </p>
      </div>
    </div>
  );
}
