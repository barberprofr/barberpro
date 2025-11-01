import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStylists, useStylistBreakdown } from "@/lib/api";

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

function Table({ id }: { id: string }) {
  const { data } = useStylistBreakdown(id);
  const daily = data?.daily;
  const monthly = data?.monthly;
  return (
    <div className="mt-2 text-sm border rounded-md overflow-hidden">
      <div className="grid grid-cols-4 bg-muted/40 px-3 py-2 font-medium">
        <div></div>
        <div>Espèces</div>
        <div>Chèque</div>
        <div>Carte</div>
      </div>
      <div className="grid grid-cols-4 px-3 py-2 border-t">
        <div className="text-muted-foreground">Jour</div>
        <div>{eur.format(daily?.methods.cash.amount || 0)}</div>
        <div>{eur.format(daily?.methods.check.amount || 0)}</div>
        <div>{eur.format(daily?.methods.card.amount || 0)}</div>
      </div>
      <div className="grid grid-cols-4 px-3 py-2 border-t">
        <div className="text-muted-foreground">Mois</div>
        <div>{eur.format(monthly?.methods.cash.amount || 0)}</div>
        <div>{eur.format(monthly?.methods.check.amount || 0)}</div>
        <div>{eur.format(monthly?.methods.card.amount || 0)}</div>
      </div>
    </div>
  );
}

export default function StylistPayments() {
  const { data: stylists } = useStylists();
  return (
    <Card className="border-none shadow-md">
      <CardHeader>
        <CardTitle className="text-lg">Modes de paiement par coiffeur</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {stylists?.map((s) => (
          <div key={s.id}>
            <div className="font-medium inline-block bg-secondary text-secondary-foreground border border-transparent rounded px-2 py-1">{s.name}</div>
            <Table id={s.id} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
