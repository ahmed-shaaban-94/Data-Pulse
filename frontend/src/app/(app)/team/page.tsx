"use client";

import { useState } from "react";
import {
  Users,
  UserPlus,
  Shield,
  Building2,
  Trash2,
  ChevronDown,
  Check,
  X,
  Plus,
} from "lucide-react";
import { useMembers, useMyAccess, useRoles, useSectors } from "@/hooks/use-members";
import type { MemberResponse, RoleKey, SectorResponse } from "@/types/members";

const ROLE_COLORS: Record<RoleKey, string> = {
  owner: "bg-chart-amber/20 text-chart-amber",
  admin: "bg-accent/20 text-accent",
  editor: "bg-emerald-500/20 text-emerald-400",
  viewer: "bg-text-secondary/20 text-text-secondary",
};

const ROLE_LABELS: Record<RoleKey, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

function RoleBadge({ role }: { role: RoleKey }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[role]}`}>
      <Shield className="h-3 w-3" />
      {ROLE_LABELS[role]}
    </span>
  );
}

function InviteDialog({
  open,
  onClose,
  onInvite,
  sectors,
}: {
  open: boolean;
  onClose: () => void;
  onInvite: (email: string, role: RoleKey, name: string, sectorIds: number[]) => Promise<void>;
  sectors: SectorResponse[];
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<RoleKey>("viewer");
  const [selectedSectors, setSelectedSectors] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await onInvite(email, role, name, selectedSectors);
      setEmail("");
      setName("");
      setRole("viewer");
      setSelectedSectors([]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite member");
    } finally {
      setLoading(false);
    }
  }

  function toggleSector(id: number) {
    setSelectedSectors((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text-primary">Invite Member</h3>
          <button onClick={onClose} className="p-1 text-text-secondary hover:text-text-primary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              placeholder="Ahmed Mohamed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as RoleKey)}
              className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            >
              <option value="viewer">Viewer — Read-only access</option>
              <option value="editor">Editor — Can run pipelines & create reports</option>
              <option value="admin">Admin — Can manage members & settings</option>
            </select>
          </div>

          {(role === "viewer" || role === "editor") && sectors.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Sector Access
              </label>
              <p className="text-xs text-text-secondary mb-2">
                Select which sectors this member can access. Leave empty for no data access.
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto rounded-lg border border-border p-2">
                {sectors.map((s) => (
                  <button
                    key={s.sector_id}
                    type="button"
                    onClick={() => toggleSector(s.sector_id)}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                      selectedSectors.includes(s.sector_id)
                        ? "bg-accent/10 text-accent"
                        : "text-text-secondary hover:bg-divider"
                    }`}
                  >
                    <div className={`flex h-4 w-4 items-center justify-center rounded border ${
                      selectedSectors.includes(s.sector_id)
                        ? "border-accent bg-accent"
                        : "border-border"
                    }`}>
                      {selectedSectors.includes(s.sector_id) && (
                        <Check className="h-3 w-3 text-white" />
                      )}
                    </div>
                    {s.sector_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-growth-red">{error}</p>}

          <button
            type="submit"
            disabled={loading || !email}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-page transition-colors hover:bg-accent/90 disabled:opacity-60"
          >
            <UserPlus className="h-4 w-4" />
            {loading ? "Inviting..." : "Send Invite"}
          </button>
        </form>
      </div>
    </div>
  );
}

function MemberRow({
  member,
  isCurrentUser,
  canManage,
  onRemove,
}: {
  member: MemberResponse;
  isCurrentUser: boolean;
  canManage: boolean;
  onRemove: (id: number) => void;
}) {
  const initials = (member.display_name || member.email)
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const isPending = member.user_id.startsWith("pending:");

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-card/80">
      {/* Avatar */}
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent/20 text-sm font-bold text-accent">
        {initials}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-text-primary">
            {member.display_name || member.email}
          </p>
          {isCurrentUser && (
            <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
              You
            </span>
          )}
          {isPending && (
            <span className="rounded-full bg-chart-amber/10 px-1.5 py-0.5 text-[10px] font-medium text-chart-amber">
              Pending
            </span>
          )}
          {!member.is_active && (
            <span className="rounded-full bg-growth-red/10 px-1.5 py-0.5 text-[10px] font-medium text-growth-red">
              Inactive
            </span>
          )}
        </div>
        <p className="truncate text-xs text-text-secondary">{member.email}</p>
      </div>

      {/* Sectors */}
      <div className="hidden items-center gap-1 sm:flex">
        {member.sectors.length > 0 ? (
          member.sectors.slice(0, 2).map((s) => (
            <span key={s.sector_id} className="rounded-md bg-divider px-2 py-0.5 text-xs text-text-secondary">
              {s.sector_name}
            </span>
          ))
        ) : (
          <span className="text-xs text-text-secondary">
            {member.role_key === "owner" || member.role_key === "admin" ? "All sectors" : "No sectors"}
          </span>
        )}
        {member.sectors.length > 2 && (
          <span className="text-xs text-text-secondary">+{member.sectors.length - 2}</span>
        )}
      </div>

      {/* Role */}
      <RoleBadge role={member.role_key} />

      {/* Actions */}
      {canManage && !isCurrentUser && member.role_key !== "owner" && (
        <button
          onClick={() => onRemove(member.member_id)}
          className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-growth-red/10 hover:text-growth-red"
          title="Remove member"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function SectorCard({
  sector,
  canManage,
  onDelete,
}: {
  sector: SectorResponse;
  canManage: boolean;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-accent" />
            <h4 className="text-sm font-medium text-text-primary">{sector.sector_name}</h4>
          </div>
          {sector.description && (
            <p className="mt-1 text-xs text-text-secondary">{sector.description}</p>
          )}
          <div className="mt-2 flex items-center gap-3 text-xs text-text-secondary">
            <span>{sector.member_count} members</span>
            <span>{sector.site_codes.length} sites</span>
          </div>
          {sector.site_codes.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {sector.site_codes.map((code) => (
                <span key={code} className="rounded bg-divider px-1.5 py-0.5 text-[10px] text-text-secondary">
                  {code}
                </span>
              ))}
            </div>
          )}
        </div>
        {canManage && (
          <button
            onClick={() => onDelete(sector.sector_id)}
            className="rounded-md p-1 text-text-secondary hover:bg-growth-red/10 hover:text-growth-red"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function CreateSectorForm({
  onSubmit,
}: {
  onSubmit: (data: { sector_key: string; sector_name: string; description: string; site_codes: string[] }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [sites, setSites] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-text-secondary transition-colors hover:border-accent hover:text-accent"
      >
        <Plus className="h-4 w-4" />
        Add Sector
      </button>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        sector_key: key.toLowerCase().replace(/\s+/g, "-"),
        sector_name: name,
        description: desc,
        site_codes: sites ? sites.split(",").map((s) => s.trim()).filter(Boolean) : [],
      });
      setKey("");
      setName("");
      setDesc("");
      setSites("");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-accent/30 bg-card p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Key</label>
          <input
            required
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="w-full rounded-md border border-border bg-page px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
            placeholder="sales-north"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-border bg-page px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
            placeholder="Sales North"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Description</label>
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          className="w-full rounded-md border border-border bg-page px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
          placeholder="Northern region sales team"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Site Codes (comma-separated)</label>
        <input
          value={sites}
          onChange={(e) => setSites(e.target.value)}
          className="w-full rounded-md border border-border bg-page px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
          placeholder="SITE-01, SITE-02"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading || !key || !name}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-page hover:bg-accent/90 disabled:opacity-60"
        >
          {loading ? "Creating..." : "Create"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-divider"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function TeamPage() {
  const { access, isLoading: accessLoading } = useMyAccess();
  const { members, isLoading: membersLoading, inviteMember, removeMember } = useMembers();
  const { sectors, isLoading: sectorsLoading, createSector, deleteSector } = useSectors();
  const [inviteOpen, setInviteOpen] = useState(false);

  const isLoading = accessLoading || membersLoading || sectorsLoading;
  const canManage = access?.is_admin ?? false;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <h1 className="text-2xl font-bold text-text-primary">Team</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-48 rounded-xl bg-card" />
          <div className="h-64 rounded-xl bg-card" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Team</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Manage members, roles, and sector access
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-page transition-colors hover:bg-accent/90"
          >
            <UserPlus className="h-4 w-4" />
            Invite Member
          </button>
        )}
      </div>

      {/* Current user access card */}
      {access && (
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-accent" />
            <div>
              <p className="text-sm font-medium text-text-primary">
                Your role: <span className="text-accent">{ROLE_LABELS[access.role_key]}</span>
              </p>
              <p className="text-xs text-text-secondary">
                {access.has_full_access
                  ? "You have full access to all data and sectors"
                  : `Access to ${access.sector_ids.length} sector(s) — ${access.site_codes.length} site(s)`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Members List */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-text-secondary" />
          <h2 className="text-lg font-semibold text-text-primary">
            Members ({members?.length ?? 0})
          </h2>
        </div>
        <div className="space-y-2">
          {members?.map((m) => (
            <MemberRow
              key={m.member_id}
              member={m}
              isCurrentUser={m.user_id === access?.user_id}
              canManage={canManage}
              onRemove={removeMember}
            />
          ))}
          {(!members || members.length === 0) && (
            <p className="text-sm text-text-secondary">No members found.</p>
          )}
        </div>
      </section>

      {/* Sectors */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="h-5 w-5 text-text-secondary" />
          <h2 className="text-lg font-semibold text-text-primary">
            Sectors ({sectors?.length ?? 0})
          </h2>
        </div>
        <p className="mb-3 text-xs text-text-secondary">
          Sectors map to site codes in your sales data. Assign members to sectors to control what data they can see.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sectors?.map((s) => (
            <SectorCard
              key={s.sector_id}
              sector={s}
              canManage={canManage}
              onDelete={deleteSector}
            />
          ))}
          {canManage && <CreateSectorForm onSubmit={createSector} />}
        </div>
      </section>

      {/* Invite Dialog */}
      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvite={inviteMember}
        sectors={sectors || []}
      />
    </div>
  );
}
