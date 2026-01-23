import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Ustawienia</h1>
        <p className="text-muted-foreground">Konfiguracja systemu NARROW OPS</p>
      </div>
      <Card className="shadow-industrial">
        <CardHeader>
          <CardTitle>Ustawienia systemu</CardTitle>
          <CardDescription>Moduł ustawień będzie dostępny w kolejnych etapach rozwoju.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Planowane funkcje: słowniki globalne, jednostki miary, typy opakowań, waluty.</p>
        </CardContent>
      </Card>
    </div>
  );
}