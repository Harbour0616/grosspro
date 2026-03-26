import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ArrowLeft } from "lucide-react";

interface CostRow {
  id: string;
  vendor_name: string | null;
  item_name: string | null;
  amount: number | null;
  memo: string | null;
}

interface ProjectData {
  contract_amount: number | null;
  sales_amount: number | null;
  customer_name: string | null;
  staff_id: string | null;
}

interface ProjectLedgerProps {
  projectId: string;
  projectName: string;
  onBack: () => void;
}

const fmtYen = (n: number) => `¥${n.toLocaleString()}`;

export default function ProjectLedger({ projectId, projectName, onBack }: ProjectLedgerProps) {
  const [project, setProject] = useState<ProjectData | null>(null);
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [staffName, setStaffName] = useState("-");

  useEffect(() => {
    async function load() {
      const { data: pj } = await supabase
        .from("projects")
        .select("contract_amount, sales_amount, customer_name, staff_id")
        .eq("id", projectId)
        .single();
      if (!pj) return;
      setProject(pj);

      if (pj.staff_id) {
        const { data: st } = await supabase
          .from("staff")
          .select("name")
          .eq("id", pj.staff_id)
          .single();
        if (st) setStaffName(st.name);
      }

      const { data: c } = await supabase
        .from("project_costs")
        .select("id, vendor_name, item_name, amount, memo")
        .eq("project_id", projectId)
        .order("id");
      if (c) setCosts(c);
    }
    load();
  }, [projectId]);

  const salesAmount = project?.sales_amount ?? 0;
  const totalCost = costs.reduce((s, c) => s + (c.amount ?? 0), 0);
  const grossProfit = salesAmount - totalCost;
  const grossRate = salesAmount > 0 ? (grossProfit / salesAmount) * 100 : 0;

  return (
    <div style={{ fontFamily: "'Noto Sans JP', sans-serif" }} className="space-y-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        戻る
      </button>

      {/* Ledger card */}
      <div className="bg-white border border-[#D0D0D0] rounded-lg overflow-hidden">
        {/* Title */}
        <div className="border-b border-[#D0D0D0] py-5">
          <h2 className="text-2xl font-bold text-center tracking-[0.5em] text-gray-800">
            工　事　台　帳
          </h2>
        </div>

        {/* Project info */}
        <div className="grid grid-cols-3 border-b border-[#D0D0D0]">
          <div className="px-6 py-3 border-r border-[#D0D0D0]">
            <span className="text-xs text-gray-500">工事名</span>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">{projectName}</p>
          </div>
          <div className="px-6 py-3 border-r border-[#D0D0D0]">
            <span className="text-xs text-gray-500">顧客名</span>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">{project?.customer_name ?? "-"}</p>
          </div>
          <div className="px-6 py-3">
            <span className="text-xs text-gray-500">担当者</span>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">{staffName}</p>
          </div>
        </div>

        {/* Summary table */}
        <div className="border-b border-[#D0D0D0]">
          <table className="w-full">
            <thead>
              <tr className="bg-[#F5F5F5]">
                <th className="text-left text-xs font-semibold text-gray-600 px-6 py-2.5 border-b border-[#D0D0D0]">項目</th>
                <th className="text-right text-xs font-semibold text-gray-600 px-6 py-2.5 border-b border-[#D0D0D0] w-48">金額</th>
              </tr>
            </thead>
            <tbody className="text-sm text-gray-800">
              <tr className="border-b border-[#D0D0D0]">
                <td className="px-6 py-2.5">契約金額</td>
                <td className="px-6 py-2.5 text-right font-medium">{fmtYen(salesAmount)}</td>
              </tr>
              <tr className="border-b border-[#D0D0D0]">
                <td className="px-6 py-2.5">現場経費合計</td>
                <td className="px-6 py-2.5 text-right font-medium">{fmtYen(totalCost)}</td>
              </tr>
              <tr className="border-b border-[#D0D0D0]">
                <td className="px-6 py-2.5 font-bold">粗利金額</td>
                <td className="px-6 py-2.5 text-right font-bold">{fmtYen(grossProfit)}</td>
              </tr>
              <tr>
                <td className="px-6 py-2.5 font-bold">粗利率</td>
                <td className="px-6 py-2.5 text-right font-bold">{grossRate.toFixed(2)}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Cost detail table */}
        <table className="w-full">
          <thead>
            <tr className="bg-[#F5F5F5]">
              <th className="text-left text-xs font-semibold text-gray-600 px-6 py-2.5 border-b border-[#D0D0D0]">業者名</th>
              <th className="text-left text-xs font-semibold text-gray-600 px-6 py-2.5 border-b border-[#D0D0D0]">業種</th>
              <th className="text-right text-xs font-semibold text-gray-600 px-6 py-2.5 border-b border-[#D0D0D0] w-40">実動経費</th>
              <th className="text-left text-xs font-semibold text-gray-600 px-6 py-2.5 border-b border-[#D0D0D0]">メモ</th>
            </tr>
          </thead>
          <tbody className="text-sm text-gray-800">
            {costs.map((c) => (
              <tr key={c.id} className="border-b border-[#D0D0D0]">
                <td className="px-6 py-2.5">{c.vendor_name ?? "-"}</td>
                <td className="px-6 py-2.5">{c.item_name ?? "-"}</td>
                <td className="px-6 py-2.5 text-right font-medium">{fmtYen(c.amount ?? 0)}</td>
                <td className="px-6 py-2.5 text-gray-500">{c.memo ?? ""}</td>
              </tr>
            ))}
            {costs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                  原価データがありません
                </td>
              </tr>
            )}
            {costs.length > 0 && (
              <tr className="bg-[#F0F0F0] font-bold">
                <td className="px-6 py-2.5" colSpan={2}>合計</td>
                <td className="px-6 py-2.5 text-right">{fmtYen(totalCost)}</td>
                <td className="px-6 py-2.5" />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
