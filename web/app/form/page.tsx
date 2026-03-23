"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { LeadForm } from "@/components/public/lead-form";

function FormContent() {
  const searchParams = useSearchParams();
  const productCode = searchParams.get("product") || "";
  return <LeadForm preselectedProduct={productCode} />;
}

export default function FormPage() {
  return (
    <main className="min-h-screen p-6 lg:p-12 max-w-xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Оставить заявку</h1>
        <p className="text-muted-foreground mt-2">Заполните форму и мы свяжемся с вами</p>
      </div>
      <Suspense fallback={<div className="text-muted-foreground">Загрузка...</div>}>
        <FormContent />
      </Suspense>
    </main>
  );
}
