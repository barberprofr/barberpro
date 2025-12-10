export default function BarberproLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg viewBox="0 0 60 70" className="w-10 h-12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path 
          d="M10 5 L10 65 L35 65 Q55 65 55 45 Q55 35 45 32 Q52 28 52 20 Q52 5 35 5 L10 5 Z M22 15 L32 15 Q38 15 38 22 Q38 28 32 28 L22 28 L22 15 Z M22 38 L35 38 Q42 38 42 47 Q42 55 35 55 L22 55 L22 38 Z" 
          fill="#374151"
        />
      </svg>
      <div className="flex items-center mt-0.5">
        <span className="text-base font-bold text-slate-300 tracking-tight">BarBerpr</span>
        <span className="relative text-base font-bold text-slate-300 tracking-tight">
          o
          <svg viewBox="0 0 12 12" className="absolute -top-0.5 -right-2 w-2.5 h-2.5">
            <path d="M2 6 L5 9 L10 3" stroke="#e74c3c" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </div>
    </div>
  );
}
