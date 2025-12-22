import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAddStylist, useAdminLogin, useConfig, useSetStylistCommission, useStylists, useStylistBreakdown } from "@/lib/api";
import { getAdminToken, setAdminToken } from "@/lib/admin";
import { playSuccessSound } from "@/lib/sounds";

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export default function CoiffeursManager() {
  const { data: stylists } = useStylists();
  const { data: config } = useConfig();
  const addStylist = useAddStylist();
  const login = useAdminLogin();
  const setCommissionMut = useSetStylistCommission();
  const [name, setName] = useState("");
  const [pct, setPct] = useState("40");
  const [expanded, setExpanded] = useState<string>("");
  const [period, setPeriod] = useState<"daily" | "monthly">("daily");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [editPct, setEditPct] = useState<Record<string, string>>({});

  const commission = useMemo(() => Math.max(0, Math.min(100, Number(pct) || 0)), [pct]);

  function onAdd() {
    const n = name.trim();
    if (!n) return;
    addStylist.mutate({ name: n, commissionPct: commission }, { onSuccess: () => { playSuccessSound(); setName(""); } });
  }

  function RowDetail({ id }: { id: string }) {
    const { data } = useStylistBreakdown(id);
    const scope = period === "daily" ? data?.daily : data?.monthly;
    return (
      <div className="mt-2 rounded-md border bg-muted/30 p-3 text-sm">
        <div className="flex items-center gap-2 mb-2">
          <button className={`px-2 py-1 rounded ${period === "daily" ? "bg-primary text-primary-foreground" : "bg-background border"}`} onClick={() => setPeriod("daily")}>Jour</button>
          <button className={`px-2 py-1 rounded ${period === "monthly" ? "bg-primary text-primary-foreground" : "bg-background border"}`} onClick={() => setPeriod("monthly")}>Mois</button>
          <div className="ml-auto text-muted-foreground">Total: <span className="font-medium text-foreground">{eur.format(scope?.total.amount || 0)}</span> • {scope?.total.count || 0} prestations</div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded bg-background border p-2">
            <div className="text-xs text-muted-foreground">Espèces</div>
            <div className="font-medium">{eur.format(scope?.methods.cash.amount || 0)}</div>
            <div className="text-xs text-muted-foreground">{scope?.methods.cash.count || 0} prestations</div>
          </div>
          <div className="rounded bg-background border p-2">
            <div className="text-xs text-muted-foreground">Planity/Treatwell</div>
            <div className="font-medium">{eur.format(scope?.methods.check.amount || 0)}</div>
            <div className="text-xs text-muted-foreground">{scope?.methods.check.count || 0} prestations</div>
          </div>
          <div className="rounded bg-background border p-2">
            <div className="text-xs text-muted-foreground">Carte</div>
            <div className="font-medium">{eur.format(scope?.methods.card.amount || 0)}</div>
            <div className="text-xs text-muted-foreground">{scope?.methods.card.count || 0} prestations</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className="border-none shadow-md">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg">Coiffeurs & Chiffre d'affaires</CardTitle>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Rémunération</span>
            <Input className="w-20" type="number" min="0" max="100" value={pct} onChange={(e) => setPct(e.target.value)} />
            <span className="text-muted-foreground">%</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!config?.isAdmin && (
          <div className="rounded-md border p-3 bg-muted/20 space-y-2">
            <div className="text-sm font-medium">Accès administrateur</div>
            {!config?.adminSet ? (
              <div className="text-xs text-muted-foreground">Créez d'abord votre compte administrateur depuis l'écran de connexion.</div>
            ) : (
              <div className="grid gap-2">
                <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Input type="password" placeholder="Mot de passe de connexion" value={password} onChange={(e) => setPassword(e.target.value)} />
                <Button size="sm" onClick={() => /.+@.+\..+/.test(email) && password && login.mutate({ email, password }, { onSuccess: (d) => { setAdminToken(d.token); setPassword(""); } })}>Se connecter</Button>
              </div>
            )}
            <div className="text-xs text-muted-foreground">Requis pour ajouter des coiffeurs et modifier les paramètres.</div>
          </div>
        )}
        <div className="text-sm text-muted-foreground">L’ajout de coiffeurs se fait désormais depuis Paramètres.</div>
        <div className="divide-y">
          {stylists?.map((s) => {
            const j = s.stats?.dailyAmount ?? 0;
            const m = s.stats?.monthlyAmount ?? 0;
            const rowPct = typeof s.commissionPct === "number" ? s.commissionPct : commission;
            const payout = (m * rowPct) / 100;
            return (
              <div key={s.id} className="py-3">
                <div className="flex items-center justify-between gap-2 cursor-pointer" onClick={() => setExpanded(expanded === s.id ? "" : s.id)}>
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="secondary">Jour: {eur.format(j)}</Badge>
                      <Badge>Mois: {eur.format(m)}</Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Rémunération ({rowPct}%)</div>
                    <div className="font-semibold">{eur.format(payout)}</div>
                  </div>
                </div>
                {config?.isAdmin && (
                  <div className="mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Input className="w-24" type="number" min="0" max="100" value={editPct[s.id] ?? String(rowPct)} onChange={(e) => setEditPct((m) => ({ ...m, [s.id]: e.target.value }))} />
                    <Button size="sm" onClick={() => { const val = Number(editPct[s.id] ?? rowPct); if (!isNaN(val)) setCommissionMut.mutate({ id: s.id, commissionPct: Math.max(0, Math.min(100, val)) }); }}>Enregistrer %</Button>
                  </div>
                )}
                {expanded === s.id && <RowDetail id={s.id} />}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
