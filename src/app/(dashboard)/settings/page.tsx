"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut, Shield, Info, CreditCard, CalendarDays, Umbrella, CalendarOff, Plus, Pencil, Trash2, RefreshCw, Database, Download, Upload } from "lucide-react";
import { Card, Button, Input, Modal } from "@/components/ui";
import { cn } from "@/lib/utils";

interface Plan {
  daysPerWeek: number;
  label: string;
  monthlyFee: number;
}

interface VacationPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

interface PublicHoliday {
  date: string;
  name: string;
}

const ALL_DAYS = [
  { key: "MON", label: "월" },
  { key: "TUE", label: "화" },
  { key: "WED", label: "수" },
  { key: "THU", label: "목" },
  { key: "FRI", label: "금" },
  { key: "SAT", label: "토" },
];

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // PIN states
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinSuccess, setPinSuccess] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  // Backup states
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [restoreFile, setRestoreFile] = useState<{ name: string; data: unknown } | null>(null);
  const [backupMsg, setBackupMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Plan states
  const [editingPlan, setEditingPlan] = useState<number | null>(null);
  const [editFee, setEditFee] = useState("");

  // Vacation modal states
  const [vacModalOpen, setVacModalOpen] = useState(false);
  const [editingVac, setEditingVac] = useState<VacationPeriod | null>(null);
  const [vacName, setVacName] = useState("");
  const [vacStart, setVacStart] = useState("");
  const [vacEnd, setVacEnd] = useState("");

  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ["plans"],
    queryFn: async () => {
      const res = await fetch("/api/settings/plans");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  // ─── Class Days ──────────────────────────────────────
  const { data: classDays } = useQuery<{ enabledDays: string[] }>({
    queryKey: ["classDays"],
    queryFn: async () => {
      const res = await fetch("/api/settings/class-days");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const classDaysMutation = useMutation({
    mutationFn: async (enabledDays: string[]) => {
      const res = await fetch("/api/settings/class-days", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabledDays }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classDays"] });
    },
  });

  function toggleClassDay(day: string) {
    const current = classDays?.enabledDays ?? [];
    const updated = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day];
    classDaysMutation.mutate(updated);
  }

  // ─── Vacations ─────────────────────────────────────
  const { data: vacations = [] } = useQuery<VacationPeriod[]>({
    queryKey: ["vacations"],
    queryFn: async () => {
      const res = await fetch("/api/settings/vacations");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const vacCreateMutation = useMutation({
    mutationFn: async (data: { name: string; startDate: string; endDate: string }) => {
      const res = await fetch("/api/settings/vacations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vacations"] });
      closeVacModal();
    },
  });

  const vacUpdateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name: string; startDate: string; endDate: string }) => {
      const res = await fetch(`/api/settings/vacations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vacations"] });
      closeVacModal();
    },
  });

  const vacDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/vacations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vacations"] });
    },
  });

  function openVacModal(vac?: VacationPeriod) {
    if (vac) {
      setEditingVac(vac);
      setVacName(vac.name);
      setVacStart(vac.startDate);
      setVacEnd(vac.endDate);
    } else {
      setEditingVac(null);
      setVacName("");
      setVacStart("");
      setVacEnd("");
    }
    setVacModalOpen(true);
  }

  function closeVacModal() {
    setVacModalOpen(false);
    setEditingVac(null);
    setVacName("");
    setVacStart("");
    setVacEnd("");
  }

  function handleVacSave() {
    if (!vacName || !vacStart || !vacEnd) return;
    if (editingVac) {
      vacUpdateMutation.mutate({ id: editingVac.id, name: vacName, startDate: vacStart, endDate: vacEnd });
    } else {
      vacCreateMutation.mutate({ name: vacName, startDate: vacStart, endDate: vacEnd });
    }
  }

  // ─── Public Holidays ───────────────────────────────
  const currentYear = new Date().getFullYear();
  const { data: holidayData } = useQuery<{ holidays: PublicHoliday[]; lastUpdatedAt: string | null }>({
    queryKey: ["holidays"],
    queryFn: async () => {
      const res = await fetch("/api/settings/holidays");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
  const holidays = holidayData?.holidays ?? [];
  const holidayLastUpdated = holidayData?.lastUpdatedAt;

  const holidayRefreshMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/settings/holidays", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "업데이트에 실패했습니다.");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
    },
  });

  const planMutation = useMutation({
    mutationFn: async ({ daysPerWeek, monthlyFee }: { daysPerWeek: number; monthlyFee: number }) => {
      const res = await fetch("/api/settings/plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daysPerWeek, monthlyFee }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      setEditingPlan(null);
      setEditFee("");
    },
  });

  async function handleBackupDownload() {
    setBackupLoading(true);
    setBackupMsg(null);
    try {
      const res = await fetch("/api/settings/backup");
      if (!res.ok) throw new Error("백업 실패");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "hongart-backup.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setBackupMsg({ type: "success", text: "백업 파일을 다운로드했습니다." });
    } catch {
      setBackupMsg({ type: "error", text: "백업 다운로드에 실패했습니다." });
    } finally {
      setBackupLoading(false);
    }
  }

  function handleRestoreFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBackupMsg(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (!data.version || !data.data) {
          setBackupMsg({ type: "error", text: "올바른 백업 파일이 아닙니다." });
          return;
        }
        setRestoreFile({ name: file.name, data });
        setRestoreConfirmOpen(true);
      } catch {
        setBackupMsg({ type: "error", text: "JSON 파일을 읽을 수 없습니다." });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleRestoreConfirm() {
    if (!restoreFile) return;
    setRestoreLoading(true);
    setBackupMsg(null);
    try {
      const res = await fetch("/api/settings/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(restoreFile.data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "복원 실패");
      }
      queryClient.invalidateQueries();
      setBackupMsg({ type: "success", text: "데이터가 복원되었습니다." });
    } catch (err) {
      setBackupMsg({ type: "error", text: err instanceof Error ? err.message : "복원에 실패했습니다." });
    } finally {
      setRestoreLoading(false);
      setRestoreConfirmOpen(false);
      setRestoreFile(null);
    }
  }

  async function handlePinChange() {
    setPinError("");
    setPinSuccess(false);

    if (!currentPin || !newPin || !confirmPin) {
      setPinError("모든 항목을 입력해 주세요");
      return;
    }

    if (newPin !== confirmPin) {
      setPinError("새 PIN이 일치하지 않습니다");
      return;
    }

    if (newPin.length < 4) {
      setPinError("새 PIN은 4자리 이상이어야 합니다");
      return;
    }

    setPinLoading(true);
    try {
      const res = await fetch("/api/settings/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin, newPin }),
      });

      const data = await res.json();

      if (!res.ok) {
        setPinError(data.error || "PIN 변경에 실패했습니다");
        return;
      }

      setPinSuccess(true);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
    } catch {
      setPinError("PIN 변경에 실패했습니다");
    } finally {
      setPinLoading(false);
    }
  }

  async function handleLogout() {
    setLogoutLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch {
      setLogoutLoading(false);
    }
  }

  function formatWon(n: number) {
    return n.toLocaleString("ko-KR") + "원";
  }

  return (
    <div className="px-4 py-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">설정</h1>

      <div className="space-y-6 max-w-lg">
        {/* Class Day Settings */}
        <Card
          header={
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary-600" />
              <h2 className="font-semibold text-gray-900">수업 요일 설정</h2>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {ALL_DAYS.map((day) => {
                const enabled = classDays?.enabledDays.includes(day.key) ?? true;
                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => toggleClassDay(day.key)}
                    className={cn(
                      "w-11 h-11 rounded-lg text-sm font-medium transition-colors",
                      enabled
                        ? "bg-primary-600 text-white"
                        : "bg-gray-100 text-gray-400 hover:bg-gray-200",
                    )}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-400">
              비활성화된 요일은 시간표/출석/학생등록에서 제외됩니다.
            </p>
          </div>
        </Card>

        {/* Vacation Settings */}
        <Card
          header={
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Umbrella className="w-5 h-5 text-primary-600" />
                <h2 className="font-semibold text-gray-900">방학 설정</h2>
              </div>
              <button
                onClick={() => openVacModal()}
                className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                <Plus className="w-4 h-4" />
                추가
              </button>
            </div>
          }
        >
          {vacations.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">등록된 방학이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {vacations.map((vac) => (
                <div
                  key={vac.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-900">{vac.name}</div>
                    <div className="text-xs text-gray-500">
                      {vac.startDate} ~ {vac.endDate}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openVacModal(vac)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => vacDeleteMutation.mutate(vac.id)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Vacation Modal */}
        <Modal
          isOpen={vacModalOpen}
          onClose={closeVacModal}
          title={editingVac ? "방학 수정" : "방학 추가"}
          footer={
            <>
              <Button variant="secondary" onClick={closeVacModal}>
                취소
              </Button>
              <Button
                onClick={handleVacSave}
                loading={vacCreateMutation.isPending || vacUpdateMutation.isPending}
              >
                {editingVac ? "수정" : "추가"}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Input
              label="방학 이름"
              placeholder="예: 여름방학"
              value={vacName}
              onChange={(e) => setVacName(e.target.value)}
            />
            <Input
              label="시작일"
              type="date"
              value={vacStart}
              onChange={(e) => setVacStart(e.target.value)}
            />
            <Input
              label="종료일"
              type="date"
              value={vacEnd}
              onChange={(e) => setVacEnd(e.target.value)}
            />
          </div>
        </Modal>

        {/* Public Holidays */}
        <Card
          header={
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarOff className="w-5 h-5 text-primary-600" />
                <h2 className="font-semibold text-gray-900">공휴일</h2>
              </div>
              <button
                onClick={() => holidayRefreshMutation.mutate()}
                disabled={holidayRefreshMutation.isPending}
                className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700 disabled:opacity-50"
              >
                <RefreshCw className={cn("w-4 h-4", holidayRefreshMutation.isPending && "animate-spin")} />
                업데이트
              </button>
            </div>
          }
        >
          {holidays.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              공휴일 데이터가 없습니다. 업데이트를 눌러주세요.
            </p>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {(() => {
                const byYear = new Map<string, PublicHoliday[]>();
                for (const h of holidays) {
                  const y = h.date.slice(0, 4);
                  if (!byYear.has(y)) byYear.set(y, []);
                  byYear.get(y)!.push(h);
                }
                return Array.from(byYear.entries()).map(([year, items]) => (
                  <div key={year}>
                    <div className="text-xs font-semibold text-gray-500 mb-1">{year}년 ({items.length}일)</div>
                    <div className="space-y-0.5">
                      {items.map((h) => (
                        <div
                          key={h.date}
                          className="flex items-center justify-between py-1 text-sm"
                        >
                          <span className="text-gray-900">{h.name}</span>
                          <span className="text-gray-500 text-xs">{h.date.slice(5)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
          {holidayRefreshMutation.isError && (
            <p className="text-xs text-red-500 mt-2">
              {holidayRefreshMutation.error instanceof Error
                ? holidayRefreshMutation.error.message
                : "업데이트에 실패했습니다."}
            </p>
          )}
          <div className="text-xs text-gray-400 mt-2 space-y-0.5">
            <p>공공데이터포털(한국천문연구원) 제공 · 공휴일에는 출석체크 불가</p>
            {holidayLastUpdated && (
              <p>마지막 업데이트: {new Date(holidayLastUpdated).toLocaleString("ko-KR")}</p>
            )}
          </div>
        </Card>

        {/* Plan Pricing */}
        <Card
          header={
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary-600" />
              <h2 className="font-semibold text-gray-900">수강료 설정</h2>
            </div>
          }
        >
          <div className="space-y-3">
            {plans.map((plan) => (
              <div
                key={plan.daysPerWeek}
                className="flex items-center justify-between py-2"
              >
                <span className="text-sm font-medium text-gray-700">
                  {plan.label}
                </span>
                {editingPlan === plan.daysPerWeek ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={editFee}
                      onChange={(e) => setEditFee(e.target.value)}
                      className="w-28 text-right text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        if (editFee) {
                          planMutation.mutate({
                            daysPerWeek: plan.daysPerWeek,
                            monthlyFee: Number(editFee),
                          });
                        }
                      }}
                      className="text-sm font-medium text-primary-600 hover:text-primary-700"
                    >
                      저장
                    </button>
                    <button
                      onClick={() => { setEditingPlan(null); setEditFee(""); }}
                      className="text-sm font-medium text-gray-400 hover:text-gray-600"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditingPlan(plan.daysPerWeek);
                      setEditFee(String(plan.monthlyFee));
                    }}
                    className="text-sm font-semibold text-gray-900 hover:text-primary-600 transition-colors"
                  >
                    {formatWon(plan.monthlyFee)}
                  </button>
                )}
              </div>
            ))}
            <p className="text-xs text-gray-400 pt-1">
              금액을 클릭하면 수정할 수 있습니다.
            </p>
          </div>
        </Card>

        {/* Data Backup */}
        <Card
          header={
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary-600" />
              <h2 className="font-semibold text-gray-900">데이터 백업</h2>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                onClick={handleBackupDownload}
                loading={backupLoading}
                variant="secondary"
                className="flex-1"
              >
                <Download className="w-4 h-4" />
                백업 다운로드
              </Button>
              <label className="flex-1">
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleRestoreFileSelect}
                />
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={(e) => {
                    const input = (e.currentTarget as HTMLElement).closest("label")?.querySelector("input");
                    input?.click();
                  }}
                >
                  <Upload className="w-4 h-4" />
                  백업에서 복원
                </Button>
              </label>
            </div>
            {backupMsg && (
              <p className={cn("text-sm", backupMsg.type === "success" ? "text-green-600" : "text-red-600")}>
                {backupMsg.text}
              </p>
            )}
            <p className="text-xs text-gray-400">
              전체 데이터를 JSON 파일로 백업하거나, 이전 백업에서 복원합니다.
            </p>
          </div>
        </Card>

        {/* Restore Confirm Modal */}
        <Modal
          isOpen={restoreConfirmOpen}
          onClose={() => { setRestoreConfirmOpen(false); setRestoreFile(null); }}
          title="데이터 복원"
          footer={
            <>
              <Button variant="secondary" onClick={() => { setRestoreConfirmOpen(false); setRestoreFile(null); }}>
                취소
              </Button>
              <Button variant="danger" onClick={handleRestoreConfirm} loading={restoreLoading}>
                복원
              </Button>
            </>
          }
        >
          <div className="space-y-2">
            <p className="text-sm text-gray-700">
              <strong>{restoreFile?.name}</strong> 파일에서 데이터를 복원합니다.
            </p>
            <p className="text-sm text-red-600 font-medium">
              현재 데이터가 백업 시점으로 완전히 대체됩니다. 계속하시겠습니까?
            </p>
          </div>
        </Modal>

        {/* PIN Change */}
        <Card
          header={
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary-600" />
              <h2 className="font-semibold text-gray-900">PIN 변경</h2>
            </div>
          }
        >
          <div className="space-y-4">
            <Input
              label="현재 PIN"
              type="password"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value)}
              placeholder="현재 PIN을 입력하세요"
            />
            <Input
              label="새 PIN"
              type="password"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="새 PIN을 입력하세요"
            />
            <Input
              label="새 PIN 확인"
              type="password"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              placeholder="새 PIN을 다시 입력하세요"
            />

            {pinError && (
              <p className="text-sm text-red-600">{pinError}</p>
            )}
            {pinSuccess && (
              <p className="text-sm text-green-600">PIN이 변경되었습니다</p>
            )}

            <Button onClick={handlePinChange} loading={pinLoading} fullWidth>
              PIN 변경
            </Button>
          </div>
        </Card>

        {/* Logout */}
        <Card>
          <Button
            variant="danger"
            fullWidth
            onClick={handleLogout}
            loading={logoutLoading}
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </Button>
        </Card>

        {/* App Info */}
        <Card
          header={
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-gray-500" />
              <h2 className="font-semibold text-gray-900">앱 정보</h2>
            </div>
          }
        >
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">앱 이름</span>
              <span className="text-gray-900 font-medium">홍아트 출석 관리 시스템</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">버전</span>
              <span className="text-gray-900 font-medium">1.0.0</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
