import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdminLogin, useAdminRecover, useAdminRecoverVerify, useAdminSetupAccount } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { normalizeSalonId, setSelectedSalon, addKnownSalon } from "@/lib/salon";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

type AuthMode = "login" | "signup" | "recover-ask" | "recover-verify";

export default function AuthGate() {
  const [mode, setMode] = useState<AuthMode>("login");

  return (
    <div className="mx-auto max-w-sm">
      <div className="flex flex-col items-center justify-center mb-4">
        <div className="h-14 w-14 grid place-items-center">
          <svg viewBox="0 0 60 60" className="h-14 w-14" aria-hidden>
            <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fill="white" style={{ fontSize: '48px', fontWeight: 800, fontFamily: 'system-ui, sans-serif' }}>B</text>
            <rect x="18" y="14" width="6" height="6" rx="1" fill="white" />
          </svg>
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">
          BarBerpro<svg viewBox="0 0 16 16" className="inline-block h-4 w-4 ml-0.5 -mt-1" aria-hidden><path d="M13.5 2L6 12l-3.5-3.5" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </h1>
      </div>
      {mode === "signup" && <Signup onSwitchLogin={()=>setMode("login")} />}
      {mode === "login" && <Login onSwitchSignup={()=>setMode("signup")} onRecover={()=>setMode("recover-ask")} />}
      {mode === "recover-ask" && <RecoverAsk onNext={()=>setMode("recover-verify")} onBack={()=>setMode("login")} />}
      {mode === "recover-verify" && <RecoverVerify onBack={()=>setMode("login")} />}
      <p className="text-center text-xs text-white mt-6">plateforme de gestion de salon de coiffure</p>
    </div>
  );
}

function Signup({ onSwitchLogin }: { onSwitchLogin: () => void }) {
  const setup = useAdminSetupAccount();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [emailConfirm, setEmailConfirm] = useState("");
  const [pwd, setPwdVal] = useState("");
  const [confirm, setConfirm] = useState("");
  const [salonName, setSalonName] = useState("");
  const [salonAddress, setSalonAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [cityFetchError, setCityFetchError] = useState("");
  const cityFetchController = useRef<AbortController | null>(null);
  const [salonPhone, setSalonPhone] = useState("");
  const [signupError, setSignupError] = useState("");
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const emailsMatch = emailValid && email.trim().toLowerCase() === emailConfirm.trim().toLowerCase();
  const passwordValid = pwd.trim().length >= 4 && pwd.toLowerCase() !== "admin";
  const passwordsMatch = passwordValid && pwd.trim() === confirm.trim();
  const phoneValid = /^[+\d][0-9\s().-]{5,}$/.test(salonPhone.trim());
  const postalValid = useMemo(() => /^\d{5}$/.test(postalCode), [postalCode]);
  const cityValid = useMemo(() => postalValid && cityOptions.includes(city), [postalValid, cityOptions, city]);
  const can = emailValid && emailsMatch && passwordValid && passwordsMatch && salonName.trim().length > 0 && salonAddress.trim().length > 0 && phoneValid && postalValid && cityValid;

  useEffect(() => {
    if (!postalValid) {
      if (cityFetchController.current) {
        cityFetchController.current.abort();
        cityFetchController.current = null;
      }
      setCityOptions([]);
      setCity("");
      setCityFetchError("");
      setCityLoading(false);
      return;
    }
    const controller = new AbortController();
    cityFetchController.current = controller;
    setCityLoading(true);
    setCityFetchError("");
    fetch(`https://geo.api.gouv.fr/communes?codePostal=${postalCode}&fields=nom&format=json`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("fetch error");
        return res.json();
      })
      .then((data: Array<{ nom?: string }>) => {
        const uniqueNames = Array.from(new Set((data ?? []).map((item) => item?.nom).filter((n): n is string => Boolean(n)))).sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
        setCityOptions(uniqueNames);
        if (uniqueNames.length === 0) {
          setCity("");
          setCityFetchError("Aucune ville trouvée pour ce code postal");
        } else {
          setCityFetchError("");
          setCity((current) => (uniqueNames.includes(current) ? current : uniqueNames[0]));
        }
      })
      .catch((error) => {
        if (error?.name === "AbortError") return;
        setCityOptions([]);
        setCity("");
        setCityFetchError("Impossible de charger les villes");
      })
      .finally(() => {
        if (cityFetchController.current === controller) {
          cityFetchController.current = null;
        }
        setCityLoading(false);
      });
  }, [postalCode, postalValid]);

  useEffect(() => () => {
    if (cityFetchController.current) {
      cityFetchController.current.abort();
    }
  }, []);

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(15,23,42,0.95)0%,rgba(30,20,60,0.85)25%,rgba(20,25,50,0.9)50%,rgba(15,30,40,0.85)75%,rgba(10,20,35,0.95)100%)] -z-10 rounded-[24px]" />
      <Card className="relative overflow-hidden rounded-[24px] border border-white/20 bg-gradient-to-br from-white/12 via-white/6 to-transparent backdrop-blur-xl shadow-[0_32px_96px_rgba(8,15,40,0.52)] text-gray-100">
        <CardHeader>
          <CardTitle className="text-center">Créer un compte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="inline-flex items-center gap-2 rounded-full border border-blue-400/50 bg-gradient-to-r from-blue-500/20 to-blue-400/10 backdrop-blur-sm px-3.5 py-1.5 text-[11px] font-semibold text-blue-100 shadow-[0_8px_16px_rgba(59,130,246,0.1),inset_0_1px_1px_rgba(255,255,255,0.2)]">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-300" />
              Email
            </label>
            <Input type="email" value={email} onChange={(e)=>{ setEmail(e.target.value); setSignupError(""); }} placeholder="vous@exemple.com" autoComplete="email" className="mt-2 bg-slate-900/70 border-white/25 text-gray-100 placeholder:text-gray-400" />
          </div>
          <div>
            <label className="inline-flex items-center gap-2 rounded-full border border-blue-400/50 bg-gradient-to-r from-blue-500/20 to-blue-400/10 backdrop-blur-sm px-3.5 py-1.5 text-[11px] font-semibold text-blue-100 shadow-[0_8px_16px_rgba(59,130,246,0.1),inset_0_1px_1px_rgba(255,255,255,0.2)]">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-300" />
              Confirmer l'email
            </label>
            <Input type="email" value={emailConfirm} onChange={(e)=>{ setEmailConfirm(e.target.value); setSignupError(""); }} placeholder="répéter votre email" autoComplete="email" className="mt-2 bg-slate-900/70 border-white/25 text-gray-100 placeholder:text-gray-400" />
            {emailConfirm && !emailsMatch && <p className="text-xs text-destructive mt-1">Les emails ne correspondent pas</p>}
          </div>
          <div>
            <label className="inline-flex items-center gap-2 rounded-full border border-purple-400/50 bg-gradient-to-r from-purple-500/20 to-purple-400/10 backdrop-blur-sm px-3.5 py-1.5 text-[11px] font-semibold text-purple-100 shadow-[0_8px_16px_rgba(168,85,247,0.1),inset_0_1px_1px_rgba(255,255,255,0.2)]">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-300" />
              Mot de passe
            </label>
            <PasswordInput value={pwd} onChange={(e)=>{ setPwdVal(e.target.value); setSignupError(""); }} placeholder="min 4 caractères" autoComplete="new-password" className="mt-2 bg-slate-900/70 border-white/25 text-gray-100 placeholder:text-gray-400" />
            {pwd && !passwordValid && <p className="text-xs text-destructive mt-1">Mot de passe invalide</p>}
          </div>
          <div>
            <label className="inline-flex items-center gap-2 rounded-full border border-purple-400/50 bg-gradient-to-r from-purple-500/20 to-purple-400/10 backdrop-blur-sm px-3.5 py-1.5 text-[11px] font-semibold text-purple-100 shadow-[0_8px_16px_rgba(168,85,247,0.1),inset_0_1px_1px_rgba(255,255,255,0.2)]">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-300" />
              Confirmer le mot de passe
            </label>
            <PasswordInput value={confirm} onChange={(e)=>{ setConfirm(e.target.value); setSignupError(""); }} autoComplete="new-password" className="mt-2 bg-slate-900/70 border-white/25 text-gray-100 placeholder:text-gray-400" />
            {confirm && !passwordsMatch && <p className="text-xs text-destructive mt-1">Les mots de passe ne correspondent pas</p>}
          </div>
          <div>
            <label className="inline-flex items-center gap-2 rounded-full border border-emerald-400/50 bg-gradient-to-r from-emerald-500/20 to-emerald-400/10 backdrop-blur-sm px-3.5 py-1.5 text-[11px] font-semibold text-emerald-100 shadow-[0_8px_16px_rgba(16,185,129,0.1),inset_0_1px_1px_rgba(255,255,255,0.2)]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              Nom du salon
            </label>
            <Input value={salonName} onChange={(e)=>{ setSalonName(e.target.value); setSignupError(""); }} placeholder="Salon Barber.Pro" autoComplete="organization" className="mt-2 bg-slate-900/70 border-white/25 text-gray-100 placeholder:text-gray-400" />
          </div>
          <div>
            <label className="inline-flex items-center gap-2 rounded-full border border-emerald-400/50 bg-gradient-to-r from-emerald-500/20 to-emerald-400/10 backdrop-blur-sm px-3.5 py-1.5 text-[11px] font-semibold text-emerald-100 shadow-[0_8px_16px_rgba(16,185,129,0.1),inset_0_1px_1px_rgba(255,255,255,0.2)]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              Adresse du salon
            </label>
            <Input value={salonAddress} onChange={(e)=>{ setSalonAddress(e.target.value); setSignupError(""); }} placeholder="123 rue de Paris" autoComplete="street-address" className="mt-2 bg-slate-900/70 border-white/25 text-gray-100 placeholder:text-gray-400" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="inline-flex items-center gap-2 rounded-full border border-amber-400/50 bg-gradient-to-r from-amber-500/20 to-amber-400/10 backdrop-blur-sm px-3.5 py-1.5 text-[11px] font-semibold text-amber-100 shadow-[0_8px_16px_rgba(217,119,6,0.1),inset_0_1px_1px_rgba(255,255,255,0.2)]">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                Code postal
              </label>
              <Input
                value={postalCode}
                onChange={(e)=> {
                  const next = e.target.value.replace(/[^0-9]/g, "").slice(0, 5);
                  setPostalCode(next);
                  setSignupError("");
                }}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="postal-code"
                placeholder="75001"
                className="mt-2 bg-slate-900/70 border-white/25 text-gray-100 placeholder:text-gray-400"
              />
              {postalCode && !postalValid && <p className="text-xs text-destructive mt-1">Code postal invalide</p>}
            </div>
            <div>
              <label className="inline-flex items-center gap-2 rounded-full border border-amber-400/50 bg-gradient-to-r from-amber-500/20 to-amber-400/10 backdrop-blur-sm px-3.5 py-1.5 text-[11px] font-semibold text-amber-100 shadow-[0_8px_16px_rgba(217,119,6,0.1),inset_0_1px_1px_rgba(255,255,255,0.2)]">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                Ville
              </label>
              <Select
                value={cityOptions.length ? city : undefined}
                onValueChange={(val)=> { setCity(val); setSignupError(""); }}
                disabled={!postalValid || cityLoading || cityOptions.length === 0}
              >
                <SelectTrigger className="mt-2 bg-slate-900/70 border-white/25 text-gray-100">
                  <SelectValue placeholder={postalValid ? (cityLoading ? "Chargement..." : "Sélectionner") : "Entrer un code postal"} />
                </SelectTrigger>
                <SelectContent>
                  {cityOptions.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cityLoading && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement des villes…</p>}
              {cityFetchError && !cityLoading && <p className="text-xs text-destructive mt-1">{cityFetchError}</p>}
            </div>
          </div>
          <div>
            <label className="inline-flex items-center gap-2 rounded-full border border-rose-400/50 bg-gradient-to-r from-rose-500/20 to-rose-400/10 backdrop-blur-sm px-3.5 py-1.5 text-[11px] font-semibold text-rose-100 shadow-[0_8px_16px_rgba(244,63,94,0.1),inset_0_1px_1px_rgba(255,255,255,0.2)]">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-300" />
              Numéro de téléphone
            </label>
            <Input type="tel" value={salonPhone} onChange={(e)=>{ setSalonPhone(e.target.value); setSignupError(""); }} placeholder="06 12 34 56 78" autoComplete="off" inputMode="tel" className="mt-2 bg-slate-900/70 border-white/25 text-gray-100 placeholder:text-gray-400" />
            {salonPhone && !phoneValid && <p className="text-xs text-destructive mt-1">Numéro de téléphone invalide</p>}
          </div>
          <Button
            className="w-full mt-2"
            disabled={!can || setup.isPending}
            onClick={()=> {
              if (!can) return;
              // Générer un salonId unique en combinant le nom normalisé avec un identifiant unique
              // Cela permet à plusieurs salons d'avoir le même nom
              const normalizedName = normalizeSalonId(salonName.trim());
              const uniqueId = Math.random().toString(36).slice(2, 8); // 6 caractères aléatoires
              const newSalonId = `${normalizedName}-${uniqueId}`;
              setup.mutate(
                {
                  salonId: newSalonId,
                  password: pwd.trim(),
                  email: email.trim(),
                  salonName: salonName.trim(),
                  salonAddress: salonAddress.trim(),
                  salonPostalCode: postalCode.trim(),
                  salonCity: city.trim(),
                  salonPhone: salonPhone.trim(),
                },
                {
                  onSuccess: () => {
                    addKnownSalon(newSalonId);
                    setSelectedSalon(newSalonId);
                    toast({
                      title: "Compte créé avec succès",
                      description: "Votre compte a été créé. Vous pouvez maintenant vous connecter.",
                    });
                    // Basculer vers le formulaire de login après un court délai pour que l'utilisateur voie le toast
                    setTimeout(() => {
                      onSwitchLogin();
                    }, 1500);
                  },
                  onError: async (err: any) => {
                    try {
                      const raw = typeof err?.message === "string" ? err.message : "";
                      const parsed = (()=>{ try { return JSON.parse(raw); } catch { return null; } })();
                      setSignupError(parsed?.error || raw || "Impossible de créer le compte");
                    } catch {
                      setSignupError("Impossible de créer le compte");
                    }
                  }
                }
              );
            }}
          >
            {setup.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Création…
              </span>
            ) : (
              "S'enregistrer"
            )}
          </Button>
          {signupError && <p className="text-xs text-destructive text-center">{signupError}</p>}
          <div className="text-center text-xs text-muted-foreground">
            Déjà un compte ? <button className="underline" onClick={onSwitchLogin}>Se connecter</button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Login({ onSwitchSignup, onRecover }: { onSwitchSignup: () => void; onRecover: () => void }) {
  const login = useAdminLogin();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [loginError, setLoginError] = useState("");
  const can = /.+@.+\..+/.test(email) && pwd.length >= 1;
  return (
    <Card className="border border-white/20 shadow-[0_24px_68px_rgba(15,23,42,0.3)] min-h-[380px] bg-white/8 text-gray-100 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-center">Se connecter</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <label className="absolute top-1 left-4 text-xs font-medium text-cyan-300 z-10">Email</label>
          <Input type="email" value={email} onChange={(e)=>{ setEmail(e.target.value); setLoginError(""); }} autoComplete="email" className="pt-8 pb-6 px-5 bg-gray-600/40 border-gray-500 rounded-2xl text-gray-100 placeholder:text-gray-300" />
        </div>
        <div className="relative">
          <label className="absolute top-1 left-4 text-xs font-medium text-cyan-300 z-10">Mot de passe personnalisé</label>
          <PasswordInput value={pwd} onChange={(e)=>{ setPwd(e.target.value); setLoginError(""); }} autoComplete="current-password" className="pt-8 pb-6 px-5 bg-gray-600/40 border-gray-500 rounded-2xl text-gray-100" />
        </div>
        <Button
          className="w-full"
          disabled={!can || login.isPending}
          onClick={()=> can && login.mutate(
            { email, password: pwd },
            {
              onSuccess: async (data: any) => {
                if (data?.salonId) {
                  addKnownSalon(data.salonId);
                  setSelectedSalon(data.salonId);
                }
                // Attendre que la query config soit refetchée et mise à jour avant de naviguer
                // Cela évite le problème de double clic où config?.isAdmin n'est pas encore mis à jour
                try {
                  await qc.refetchQueries({ queryKey: ["config"], type: "active" });
                  navigate("/app");
                } catch (error) {
                  // En cas d'erreur, naviguer quand même après un court délai
                  console.error("Error refetching config:", error);
                  setTimeout(() => navigate("/app"), 500);
                }
              },
              onError: async (err: any) => {
                try {
                  const raw = typeof err?.message === "string" ? err.message : "";
                  const parsed = (()=>{ try { return JSON.parse(raw); } catch { return null; } })();
                  setLoginError(parsed?.error || raw || "Connexion impossible");
                } catch {
                  setLoginError("Connexion impossible");
                }
              }
            }
          )}
        >Connexion</Button>
        {loginError && <p className="text-xs text-destructive text-center">{loginError}</p>}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <button className="underline" onClick={onRecover}>Mot de passe oublié ?</button>
          <button className="underline" onClick={onSwitchSignup}>Créer un compte</button>
        </div>
      </CardContent>
    </Card>
  );
}

function RecoverAsk({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const recover = useAdminRecover();
  const [email, setEmail] = useState("");
  const can = /.+@.+\..+/.test(email);
  return (
    <Card className="border-none shadow-lg bg-gray-900 text-gray-100">
      <CardHeader>
        <CardTitle className="text-center">Récupération</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="text-sm font-medium">Email</label>
          <Input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="vous@exemple.com" className="mt-1 bg-gray-800 border-gray-700 text-gray-100 placeholder:text-gray-400" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="w-1/3" onClick={onBack}>Retour</Button>
          <Button className="flex-1" disabled={!can || recover.isPending} onClick={()=> recover.mutate(email, { onSuccess: onNext })}>Envoyer le code</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RecoverVerify({ onBack }: { onBack: () => void }) {
  const verify = useAdminRecoverVerify();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pwd, setPwd] = useState("");
  const can = /.+@.+\..+/.test(email) && code.length >= 4 && pwd.length >= 4;
  return (
    <Card className="border-none shadow-lg bg-gray-900 text-gray-100">
      <CardHeader>
        <CardTitle className="text-center">Nouveau mot de passe</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="text-sm font-medium">Email</label>
          <Input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} className="mt-1 bg-gray-800 border-gray-700 text-gray-100 placeholder:text-gray-400" />
        </div>
        <div>
          <label className="text-sm font-medium">Code reçu</label>
          <Input type="text" value={code} onChange={(e)=>setCode(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" className="mt-1 bg-gray-800 border-gray-700 text-gray-100 placeholder:text-gray-400" />
        </div>
        <div>
          <label className="text-sm font-medium">Nouveau mot de passe</label>
          <PasswordInput value={pwd} onChange={(e)=>setPwd(e.target.value)} className="mt-1 bg-gray-800 border-gray-700 text-gray-100 placeholder:text-gray-400" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="w-1/3" onClick={onBack}>Retour</Button>
          <Button className="flex-1" disabled={!can || verify.isPending} onClick={()=> can && verify.mutate({ email, code, newPassword: pwd }, { onSuccess: (data: any) => {
            if (data?.salonId) {
              addKnownSalon(data.salonId);
              setSelectedSalon(data.salonId);
            }
            navigate("/app");
          } })}>Valider</Button>
        </div>
      </CardContent>
    </Card>
  );
}
