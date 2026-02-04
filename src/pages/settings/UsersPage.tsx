import { useState } from "react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { z } from "zod";
import { toast } from "sonner";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Eye,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useUsers,
  useUpdateUser,
  useAddUserRole,
  useRemoveUserRole,
  useInviteUser,
  type AppUser,
  type UserRole,
} from "@/hooks/useUsers";
import { useCompanies } from "@/hooks/useCompanies";
import { useFacilities } from "@/hooks/useFacilities";

const ROLE_LABELS: Record<string, string> = {
  global_admin: "Administrator Globalny",
  facility_admin: "Administrator Zakładu",
  operator: "Operator Produkcji",
  viewer: "Podgląd",
};

const ROLE_ICONS: Record<string, React.ReactNode> = {
  global_admin: <ShieldAlert className="h-3 w-3" />,
  facility_admin: <ShieldCheck className="h-3 w-3" />,
  operator: <Shield className="h-3 w-3" />,
  viewer: <Eye className="h-3 w-3" />,
};

const ROLE_COLORS: Record<string, string> = {
  global_admin: "bg-red-500/10 text-red-700 border-red-200",
  facility_admin: "bg-blue-500/10 text-blue-700 border-blue-200",
  operator: "bg-green-500/10 text-green-700 border-green-200",
  viewer: "bg-muted text-muted-foreground",
};

export default function UsersPage() {
  const { data: users, isLoading } = useUsers();
  const { data: companies } = useCompanies();
  const { data: facilities } = useFacilities();
  const updateUser = useUpdateUser();
  const addRole = useAddUserRole();
  const removeRole = useRemoveUserRole();
  const inviteUser = useInviteUser();

  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editFullName, setEditFullName] = useState("");

  const [addingRoleUser, setAddingRoleUser] = useState<AppUser | null>(null);
  const [newRole, setNewRole] = useState<string>("");
  const [newRoleCompany, setNewRoleCompany] = useState<string>("");
  const [newRoleFacility, setNewRoleFacility] = useState<string>("");

  const [removingRole, setRemovingRole] = useState<UserRole | null>(null);

  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFullName, setInviteFullName] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("viewer");
  const [inviteCompany, setInviteCompany] = useState<string>("");

  const handleEditUser = (user: AppUser) => {
    setEditingUser(user);
    setEditFullName(user.full_name || "");
  };

  const handleSaveUser = () => {
    if (!editingUser) return;
    updateUser.mutate(
      { userId: editingUser.id, fullName: editFullName },
      {
        onSuccess: () => setEditingUser(null),
      }
    );
  };

  const handleAddRole = (user: AppUser) => {
    setAddingRoleUser(user);
    setNewRole("");
    setNewRoleCompany("");
    setNewRoleFacility("");
  };

  const handleSaveRole = () => {
    if (!addingRoleUser || !newRole) return;
    addRole.mutate(
      {
        userId: addingRoleUser.id,
        role: newRole as any,
        companyId: newRoleCompany || null,
        facilityId: newRoleFacility || null,
      },
      {
        onSuccess: () => setAddingRoleUser(null),
      }
    );
  };

  const handleRemoveRole = () => {
    if (!removingRole) return;
    removeRole.mutate(removingRole.id, {
      onSuccess: () => setRemovingRole(null),
    });
  };

  const inviteSchema = z.object({
    email: z.string()
      .trim()
      .min(1, { message: "Email jest wymagany" })
      .email({ message: "Nieprawidłowy format adresu email" })
      .max(255, { message: "Email zbyt długi" }),
    fullName: z.string()
      .trim()
      .min(2, { message: "Imię i nazwisko wymagane (min. 2 znaki)" })
      .max(100, { message: "Imię i nazwisko zbyt długie" }),
    password: z.string()
      .min(6, { message: "Hasło musi mieć minimum 6 znaków" })
      .max(72, { message: "Hasło zbyt długie" }),
  });

  const handleInviteUser = () => {
    const validation = inviteSchema.safeParse({
      email: inviteEmail,
      fullName: inviteFullName,
      password: invitePassword,
    });

    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    inviteUser.mutate(
      {
        email: validation.data.email,
        fullName: validation.data.fullName,
        password: validation.data.password,
        role: inviteRole as any,
        companyId: inviteCompany || undefined,
      },
      {
        onSuccess: () => {
          setShowInviteDialog(false);
          setInviteEmail("");
          setInviteFullName("");
          setInvitePassword("");
          setInviteRole("viewer");
          setInviteCompany("");
        },
      }
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Zarządzanie użytkownikami
            </h1>
            <p className="text-muted-foreground">
              Dodawanie, edycja użytkowników i przypisywanie ról
            </p>
          </div>
        </div>
        <Button onClick={() => setShowInviteDialog(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Zaproś użytkownika
        </Button>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lista użytkowników</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Użytkownik</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Data utworzenia</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {user.full_name || "(brak nazwy)"}
                        </div>
                        <div className="text-sm text-muted-foreground font-mono">
                          {user.id.slice(0, 8)}...
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.length === 0 ? (
                          <span className="text-sm text-muted-foreground italic">
                            Brak ról
                          </span>
                        ) : (
                          user.roles.map((role) => (
                            <Badge
                              key={role.id}
                              variant="outline"
                              className={`gap-1 ${ROLE_COLORS[role.role] || ""}`}
                            >
                              {ROLE_ICONS[role.role]}
                              {ROLE_LABELS[role.role] || role.role}
                              {role.company_name && (
                                <span className="text-xs opacity-70">
                                  ({role.company_name})
                                </span>
                              )}
                              <button
                                onClick={() => setRemovingRole(role)}
                                className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => handleAddRole(user)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.created_at
                        ? format(new Date(user.created_at), "d MMM yyyy", {
                            locale: pl,
                          })
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditUser(user)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edycja użytkownika</DialogTitle>
            <DialogDescription>
              Zmień dane profilu użytkownika
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Imię i nazwisko</Label>
              <Input
                id="fullName"
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                placeholder="Jan Kowalski"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Anuluj
            </Button>
            <Button onClick={handleSaveUser} disabled={updateUser.isPending}>
              Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Role Dialog */}
      <Dialog
        open={!!addingRoleUser}
        onOpenChange={() => setAddingRoleUser(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj rolę</DialogTitle>
            <DialogDescription>
              Przypisz nową rolę użytkownikowi: {addingRoleUser?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Rola</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz rolę" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global_admin">
                    Administrator Globalny
                  </SelectItem>
                  <SelectItem value="facility_admin">
                    Administrator Zakładu
                  </SelectItem>
                  <SelectItem value="operator">Operator Produkcji</SelectItem>
                  <SelectItem value="viewer">Podgląd</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newRole && newRole !== "global_admin" && (
              <>
                <div className="space-y-2">
                  <Label>Firma (opcjonalnie)</Label>
                  <Select
                    value={newRoleCompany || "__all__"}
                    onValueChange={(val) => setNewRoleCompany(val === "__all__" ? "" : val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Wszystkie firmy" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Wszystkie firmy</SelectItem>
                      {companies?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {newRoleCompany && (
                  <div className="space-y-2">
                    <Label>Zakład (opcjonalnie)</Label>
                    <Select
                      value={newRoleFacility || "__all__"}
                      onValueChange={(val) => setNewRoleFacility(val === "__all__" ? "" : val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Wszystkie zakłady" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Wszystkie zakłady</SelectItem>
                        {facilities
                          ?.filter((f) => f.company_id === newRoleCompany)
                          .map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddingRoleUser(null)}>
              Anuluj
            </Button>
            <Button
              onClick={handleSaveRole}
              disabled={!newRole || addRole.isPending}
            >
              Dodaj rolę
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Role Confirmation */}
      <AlertDialog
        open={!!removingRole}
        onOpenChange={() => setRemovingRole(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć rolę?</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć rolę{" "}
              <strong>{ROLE_LABELS[removingRole?.role || ""] || removingRole?.role}</strong>
              {removingRole?.company_name && (
                <> dla firmy <strong>{removingRole.company_name}</strong></>
              )}
              ? Użytkownik straci związane z nią uprawnienia.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveRole}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Usuń rolę
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invite User Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zaproś nowego użytkownika</DialogTitle>
            <DialogDescription>
              Wyślij zaproszenie na adres email. Użytkownik otrzyma link do
              ustawienia hasła.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="inviteEmail">Email</Label>
              <Input
                id="inviteEmail"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="jan.kowalski@firma.pl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inviteFullName">Imię i nazwisko</Label>
              <Input
                id="inviteFullName"
                value={inviteFullName}
                onChange={(e) => setInviteFullName(e.target.value)}
                placeholder="Jan Kowalski"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invitePassword">Hasło</Label>
              <Input
                id="invitePassword"
                type="password"
                value={invitePassword}
                onChange={(e) => setInvitePassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">
                Minimum 6 znaków
              </p>
            </div>
            <div className="space-y-2">
              <Label>Początkowa rola</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Podgląd</SelectItem>
                  <SelectItem value="operator">Operator Produkcji</SelectItem>
                  <SelectItem value="facility_admin">
                    Administrator Zakładu
                  </SelectItem>
                  <SelectItem value="global_admin">
                    Administrator Globalny
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {inviteRole !== "global_admin" && (
              <div className="space-y-2">
                <Label>Firma (opcjonalnie)</Label>
                <Select
                  value={inviteCompany || "__all__"}
                  onValueChange={(val) => setInviteCompany(val === "__all__" ? "" : val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wszystkie firmy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Wszystkie firmy</SelectItem>
                    {companies?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowInviteDialog(false)}
            >
              Anuluj
            </Button>
            <Button
              onClick={handleInviteUser}
              disabled={!inviteEmail || !inviteFullName || !invitePassword || inviteUser.isPending}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Wyślij zaproszenie
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
