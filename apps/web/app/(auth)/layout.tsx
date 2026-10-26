import Image from 'next/image';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="flex w-full max-w-[380px] flex-col gap-6">
        {/* Brand Header tối giản, trung tính */}
        <div className="flex flex-col items-center gap-2.5 text-center">
          <div className="flex size-11 items-center justify-center rounded-xl border border-border/80 bg-card p-2 shadow-2xs">
            <Image
              src="/brand/logo-mark.png"
              alt="Thịnh Thế Vinh Hoa"
              width={32}
              height={32}
              className="object-contain"
              priority
            />
          </div>
          <div className="space-y-0.5">
            <h1 className="font-heading text-base font-semibold tracking-tight text-foreground">
              Thịnh Thế Vinh Hoa
            </h1>
            <p className="text-xs text-muted-foreground">
              Hệ thống giám sát &amp; đối soát chứng từ SAP
            </p>
          </div>
        </div>

        {/* Form Card */}
        {children}

        {/* Minimal Footer */}
        <p className="text-center text-[11px] text-muted-foreground">
          Lưu hành nội bộ • Maycha Operations
        </p>
      </div>
    </div>
  );
}
