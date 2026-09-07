"use client"

import { useState, type FormEvent } from "react"
import { Pencil, Plus, ShieldCheck, Trash2, Wand2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/toast"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { errorMessage } from "@/lib/api-client"
import {
  useCoverageRoles,
  usePositionGroups,
  useSaveCoverageRole,
  useDeleteCoverageRole,
  useSavePositionGroup,
  useDeletePositionGroup,
  useApplyCoverageTemplate,
  useQualifications,
  useSaveQualification,
  useDeleteQualification,
  useSaveRequirements,
  type CoverageRole,
  type PositionGroup,
  type Qualification,
} from "@/features/coverage/hooks"
import Link from "next/link"
import { SettingsCard } from "./settings-card"

const EMPTY_ROLE = { name: "", sortOrder: 0, minDay: 1, targetDay: 1, minNight: 0, targetNight: 0, requiredQualification: "" }
const EMPTY_GROUP = { name: "", sortOrder: 0, color: "#2563EB", defaultCoverageRoleId: "" }
const EMPTY_QUALIFICATION = { code: "", name: "", color: "#0EA5E9", sortOrder: 0 }

/** One sign-off requirement while it is being edited. */
interface RequirementDraft {
  qualificationId: string
  countDay: number
  countNight: number
}

/**
 * Coverage rules: the roles a shift must be staffed with (with red/amber
 * thresholds) and the position groups that tell the app which role each
 * worker fills by default. Duty codes that override the default are set on
 * custom shift types.
 */
export function CoverageCard({ isAdmin }: { isAdmin: boolean }) {
  const toast = useToast()
  const confirm = useConfirm()
  const roles = useCoverageRoles()
  const groups = usePositionGroups()
  const saveRole = useSaveCoverageRole()
  const deleteRole = useDeleteCoverageRole()
  const saveGroup = useSavePositionGroup()
  const deleteGroup = useDeletePositionGroup()
  const applyTemplate = useApplyCoverageTemplate()
  const qualifications = useQualifications()
  const saveQualification = useSaveQualification()
  const deleteQualification = useDeleteQualification()
  const saveRequirements = useSaveRequirements()

  const [roleForm, setRoleForm] = useState<(typeof EMPTY_ROLE & { id?: string }) | null>(null)
  const [groupForm, setGroupForm] = useState<(typeof EMPTY_GROUP & { id?: string }) | null>(null)
  const [qualForm, setQualForm] = useState<(typeof EMPTY_QUALIFICATION & { id?: string }) | null>(null)
  /** Sign-off requirements being edited alongside the role form */
  const [reqDraft, setReqDraft] = useState<RequirementDraft[]>([])

  const roleList = roles.data ?? []
  const groupList = groups.data ?? []
  const qualList = qualifications.data ?? []
  const nothingConfigured = roles.isSuccess && groups.isSuccess && roleList.length === 0 && groupList.length === 0

  const submitRole = async (e: FormEvent) => {
    e.preventDefault()
    if (!roleForm) return
    try {
      const { data: saved } = await saveRole.mutateAsync({
        ...roleForm,
        requiredQualification: roleForm.requiredQualification.trim() || null,
      })
      // Requirements are a separate resource, saved as a complete set
      await saveRequirements.mutateAsync({
        roleId: saved.id,
        requirements: reqDraft.filter((r) => r.qualificationId && (r.countDay > 0 || r.countNight > 0)),
      })
      toast.success(roleForm.id ? "Role updated" : "Role added")
      setRoleForm(null)
      setReqDraft([])
    } catch (error) {
      toast.error(errorMessage(error, "Failed to save role"))
    }
  }

  const removeRole = async (r: CoverageRole) => {
    if (!(await confirm({ title: `Delete ${r.name}?`, description: "Groups and duty codes that point at this role will stop counting toward coverage.", confirmLabel: "Delete", destructive: true }))) return
    try {
      await deleteRole.mutateAsync(r.id)
      toast.success("Role deleted")
    } catch (error) {
      toast.error(errorMessage(error, "Failed to delete role"))
    }
  }

  const submitGroup = async (e: FormEvent) => {
    e.preventDefault()
    if (!groupForm) return
    try {
      await saveGroup.mutateAsync({ ...groupForm, defaultCoverageRoleId: groupForm.defaultCoverageRoleId || null })
      toast.success(groupForm.id ? "Group updated" : "Group added")
      setGroupForm(null)
    } catch (error) {
      toast.error(errorMessage(error, "Failed to save group"))
    }
  }

  const removeGroup = async (g: PositionGroup) => {
    if (!(await confirm({ title: `Delete ${g.name}?`, description: "Workers in this group are kept but will no longer count toward any role.", confirmLabel: "Delete", destructive: true }))) return
    try {
      await deleteGroup.mutateAsync(g.id)
      toast.success("Group deleted")
    } catch (error) {
      toast.error(errorMessage(error, "Failed to delete group"))
    }
  }

  const submitQualification = async (e: FormEvent) => {
    e.preventDefault()
    if (!qualForm) return
    try {
      await saveQualification.mutateAsync(qualForm)
      toast.success(qualForm.id ? "Sign-off updated" : "Sign-off added")
      setQualForm(null)
    } catch (error) {
      toast.error(errorMessage(error, "Failed to save sign-off"))
    }
  }

  const removeQualification = async (q: Qualification) => {
    if (!(await confirm({
      title: `Delete ${q.name}?`,
      description: "It is removed from every worker who holds it, and from any role that requires it.",
      confirmLabel: "Delete",
      destructive: true,
    }))) return
    try {
      await deleteQualification.mutateAsync(q.id)
      toast.success("Sign-off deleted")
    } catch (error) {
      toast.error(errorMessage(error, "Failed to delete sign-off"))
    }
  }

  const runTemplate = async () => {
    const ok = await confirm({
      title: "Apply the offshore operations template?",
      description: "Adds OIM, Production Supervisor, Production Lead, Control Room and Outside Ops roles, matching position groups, and duty codes such as OCR-D, CCR-D, BCCR-D and PL-D. Existing items with the same names are updated.",
      confirmLabel: "Apply",
    })
    if (!ok) return
    try {
      const { data: r } = await applyTemplate.mutateAsync()
      toast.success(`Template applied: ${r.roles} roles, ${r.groups} groups, ${r.codes} duty codes`)
    } catch (error) {
      toast.error(errorMessage(error, "Failed to apply template"))
    }
  }

  const num = (v: string) => Math.max(0, Number.parseInt(v || "0", 10) || 0)

  return (
    <div id="coverage" className="md:col-span-2 scroll-mt-20">
      <SettingsCard
        icon={ShieldCheck}
        title="Coverage"
        description="Who a shift must be staffed with, and how short is too short"
        action={
          isAdmin ? (
            <Button size="sm" variant="outline" onClick={runTemplate} disabled={applyTemplate.isPending}>
              <Wand2 className="h-4 w-4 mr-1" /> {applyTemplate.isPending ? "Applying…" : "Offshore ops template"}
            </Button>
          ) : undefined
        }
      >
        {nothingConfigured && (
          <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            Coverage is not set up. Add roles and position groups below, or apply the offshore operations template to start from the
            standard OIM / supervisor / lead / control room / outside ops layout.
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Roles */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-sm">Coverage roles</h4>
                <p className="text-xs text-muted-foreground">
                  Red below minimum, amber below target.{" "}
                  <Link href="/help#coverage-role" className="underline">What is a coverage role?</Link>
                </p>
              </div>
              {isAdmin && !roleForm && (
                <Button size="sm" variant="ghost" onClick={() => { setRoleForm({ ...EMPTY_ROLE, sortOrder: roleList.length + 1 }); setReqDraft([]) }}>
                  <Plus className="h-4 w-4 mr-1" /> Role
                </Button>
              )}
            </div>

            {roleForm && (
              <form onSubmit={submitRole} className="p-3 border rounded-lg bg-muted/50 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <Label htmlFor="cov-role-name">Name</Label>
                    <Input id="cov-role-name" value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} required maxLength={60} placeholder="e.g. Control Room" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="cov-role-order">Order</Label>
                    <Input id="cov-role-order" type="number" min={0} value={roleForm.sortOrder} onChange={(e) => setRoleForm({ ...roleForm, sortOrder: num(e.target.value) })} />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      ["minDay", "Day min"],
                      ["targetDay", "Day target"],
                      ["minNight", "Night min"],
                      ["targetNight", "Night target"],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key} className="space-y-1">
                      <Label htmlFor={`cov-role-${key}`}>{label}</Label>
                      <Input id={`cov-role-${key}`} type="number" min={0} max={99} value={roleForm[key]} onChange={(e) => setRoleForm({ ...roleForm, [key]: num(e.target.value) })} />
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cov-role-qual">Required qualification (optional)</Label>
                  <Input id="cov-role-qual" value={roleForm.requiredQualification} onChange={(e) => setRoleForm({ ...roleForm, requiredQualification: e.target.value })} maxLength={40} placeholder="e.g. CCR" />
                  <p className="text-xs text-muted-foreground">Workers without this qualification are shown on the line but not counted.</p>
                </div>
                <div className="space-y-2 rounded-md border bg-background p-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Sign-offs needed on shift</Label>
                      <p className="text-xs text-muted-foreground">
                        Each one must be a different person.{" "}
                        <Link href="/help#sign-off" className="underline">Why that matters</Link>
                      </p>
                    </div>
                    {qualList.length > 0 && (
                      <Button
                        size="sm"
                        type="button"
                        variant="ghost"
                        onClick={() => setReqDraft([...reqDraft, { qualificationId: "", countDay: 1, countNight: 1 }])}
                      >
                        <Plus className="h-4 w-4 mr-1" /> Add
                      </Button>
                    )}
                  </div>

                  {qualList.length === 0 && (
                    <p className="text-xs text-muted-foreground">Define sign-offs below first.</p>
                  )}

                  {reqDraft.map((req, i) => {
                    const taken = new Set(reqDraft.filter((_, j) => j !== i).map((r) => r.qualificationId))
                    return (
                      <div key={i} className="flex items-end gap-2">
                        <div className="flex-1 space-y-1">
                          {i === 0 && <Label htmlFor={`cov-req-${i}`}>Sign-off</Label>}
                          <select
                            id={`cov-req-${i}`}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                            value={req.qualificationId}
                            onChange={(e) => setReqDraft(reqDraft.map((r, j) => (j === i ? { ...r, qualificationId: e.target.value } : r)))}
                            required
                          >
                            <option value="">Choose…</option>
                            {qualList.filter((q) => !taken.has(q.id)).map((q) => (
                              <option key={q.id} value={q.id}>{q.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="w-16 space-y-1">
                          {i === 0 && <Label htmlFor={`cov-req-day-${i}`}>Days</Label>}
                          <Input id={`cov-req-day-${i}`} type="number" min={0} max={9} className="h-9" value={req.countDay} onChange={(e) => setReqDraft(reqDraft.map((r, j) => (j === i ? { ...r, countDay: num(e.target.value) } : r)))} />
                        </div>
                        <div className="w-16 space-y-1">
                          {i === 0 && <Label htmlFor={`cov-req-night-${i}`}>Nights</Label>}
                          <Input id={`cov-req-night-${i}`} type="number" min={0} max={9} className="h-9" value={req.countNight} onChange={(e) => setReqDraft(reqDraft.map((r, j) => (j === i ? { ...r, countNight: num(e.target.value) } : r)))} />
                        </div>
                        <Button size="sm" type="button" variant="ghost" aria-label="Remove sign-off requirement" onClick={() => setReqDraft(reqDraft.filter((_, j) => j !== i))}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )
                  })}
                </div>

                <div className="flex gap-2">
                  <Button size="sm" type="submit" disabled={saveRole.isPending || saveRequirements.isPending}>{saveRole.isPending || saveRequirements.isPending ? "Saving…" : "Save"}</Button>
                  <Button size="sm" type="button" variant="outline" onClick={() => { setRoleForm(null); setReqDraft([]) }}>Cancel</Button>
                </div>
              </form>
            )}

            <ul className="space-y-2">
              {roleList.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 p-2 border rounded text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {r.name}
                      {r.requiredQualification && <span className="ml-2 text-xs font-normal text-muted-foreground">needs {r.requiredQualification}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      Days {r.minDay}–{r.targetDay} · Nights {r.minNight}–{r.targetNight}
                    </p>
                    {(r.requirements ?? []).length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Needs {(r.requirements ?? []).map((q) => `${q.countDay > 1 ? `${q.countDay}× ` : ""}${q.qualification.name}`).join(", ")}
                      </p>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex shrink-0">
                      <Button variant="ghost" size="sm" aria-label={`Edit ${r.name}`} onClick={() => {
                        setRoleForm({ id: r.id, name: r.name, sortOrder: r.sortOrder, minDay: r.minDay, targetDay: r.targetDay, minNight: r.minNight, targetNight: r.targetNight, requiredQualification: r.requiredQualification ?? "" })
                        setReqDraft((r.requirements ?? []).map((q) => ({ qualificationId: q.qualificationId, countDay: q.countDay, countNight: q.countNight })))
                      }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" aria-label={`Delete ${r.name}`} onClick={() => removeRole(r)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
              {roles.isSuccess && roleList.length === 0 && <li className="text-center text-muted-foreground py-3 text-sm">No roles yet</li>}
            </ul>
          </section>

          {/* Position groups */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-sm">Position groups</h4>
                <p className="text-xs text-muted-foreground">
                  Each worker belongs to a group; a plain day or night shift counts toward the group&apos;s role.{" "}
                  <Link href="/help#position-group" className="underline">More</Link>
                </p>
              </div>
              {isAdmin && !groupForm && (
                <Button size="sm" variant="ghost" onClick={() => setGroupForm({ ...EMPTY_GROUP, sortOrder: groupList.length + 1 })}>
                  <Plus className="h-4 w-4 mr-1" /> Group
                </Button>
              )}
            </div>

            {groupForm && (
              <form onSubmit={submitGroup} className="p-3 border rounded-lg bg-muted/50 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <Label htmlFor="cov-group-name">Name</Label>
                    <Input id="cov-group-name" value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} required maxLength={60} placeholder="e.g. Ops Techs" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="cov-group-order">Order</Label>
                    <Input id="cov-group-order" type="number" min={0} value={groupForm.sortOrder} onChange={(e) => setGroupForm({ ...groupForm, sortOrder: num(e.target.value) })} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <Label htmlFor="cov-group-role">Counts toward</Label>
                    <select
                      id="cov-group-role"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={groupForm.defaultCoverageRoleId}
                      onChange={(e) => setGroupForm({ ...groupForm, defaultCoverageRoleId: e.target.value })}
                    >
                      <option value="">Nothing (not counted)</option>
                      {roleList.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="cov-group-color">Colour</Label>
                    <input id="cov-group-color" type="color" className="h-10 w-full rounded cursor-pointer" value={groupForm.color} onChange={(e) => setGroupForm({ ...groupForm, color: e.target.value })} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" type="submit" disabled={saveGroup.isPending}>{saveGroup.isPending ? "Saving…" : "Save"}</Button>
                  <Button size="sm" type="button" variant="outline" onClick={() => setGroupForm(null)}>Cancel</Button>
                </div>
              </form>
            )}

            <ul className="space-y-2">
              {groupList.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2 p-2 border rounded text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: g.color ?? "#94a3b8" }} aria-hidden />
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {g.name}
                        {g._count && <span className="ml-2 text-xs font-normal text-muted-foreground">{g._count.members} workers</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {g.defaultCoverageRole ? `Counts toward ${g.defaultCoverageRole.name}` : "Not counted (e.g. management)"}
                      </p>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex shrink-0">
                      <Button variant="ghost" size="sm" aria-label={`Edit ${g.name}`} onClick={() => setGroupForm({ id: g.id, name: g.name, sortOrder: g.sortOrder, color: g.color ?? "#2563EB", defaultCoverageRoleId: g.defaultCoverageRoleId ?? "" })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" aria-label={`Delete ${g.name}`} onClick={() => removeGroup(g)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
              {groups.isSuccess && groupList.length === 0 && <li className="text-center text-muted-foreground py-3 text-sm">No groups yet</li>}
            </ul>
          </section>
        </div>

        {/* Sign-offs */}
        <section className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-sm">Sign-offs</h4>
              <p className="text-xs text-muted-foreground">
                Training a worker is signed off on. Tick them per worker on the Workers page; require them per role above.
              </p>
            </div>
            {isAdmin && !qualForm && (
              <Button size="sm" variant="ghost" onClick={() => setQualForm({ ...EMPTY_QUALIFICATION, sortOrder: qualList.length + 1 })}>
                <Plus className="h-4 w-4 mr-1" /> Sign-off
              </Button>
            )}
          </div>

          {qualForm && (
            <form onSubmit={submitQualification} className="p-3 border rounded-lg bg-muted/50 grid gap-2 sm:grid-cols-[8rem_1fr_5rem_auto] sm:items-end">
              <div className="space-y-1">
                <Label htmlFor="cov-qual-code">Code</Label>
                <Input
                  id="cov-qual-code"
                  value={qualForm.code}
                  onChange={(e) => setQualForm({ ...qualForm, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })}
                  required
                  maxLength={16}
                  placeholder="UTIL"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cov-qual-name">Name</Label>
                <Input id="cov-qual-name" value={qualForm.name} onChange={(e) => setQualForm({ ...qualForm, name: e.target.value })} required maxLength={60} placeholder="Utilities Operator" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cov-qual-color">Colour</Label>
                <input id="cov-qual-color" type="color" className="h-10 w-full rounded cursor-pointer" value={qualForm.color} onChange={(e) => setQualForm({ ...qualForm, color: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" type="submit" disabled={saveQualification.isPending}>{saveQualification.isPending ? "Saving…" : "Save"}</Button>
                <Button size="sm" type="button" variant="outline" onClick={() => setQualForm(null)}>Cancel</Button>
              </div>
            </form>
          )}

          <ul className="flex flex-wrap gap-2">
            {qualList.map((q) => (
              <li key={q.id} className="flex items-center gap-2 rounded-full border py-1 pl-3 pr-1 text-sm">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: q.color ?? "#94a3b8" }} aria-hidden />
                <span className="font-medium">{q.name}</span>
                <span className="text-xs text-muted-foreground">{q.code}</span>
                {isAdmin && (
                  <>
                    <button type="button" aria-label={`Edit ${q.name}`} className="text-muted-foreground hover:text-foreground" onClick={() => setQualForm({ id: q.id, code: q.code, name: q.name, color: q.color ?? "#0EA5E9", sortOrder: q.sortOrder })}>
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" aria-label={`Delete ${q.name}`} className="text-muted-foreground hover:text-destructive" onClick={() => removeQualification(q)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </li>
            ))}
            {qualifications.isSuccess && qualList.length === 0 && (
              <li className="text-sm text-muted-foreground py-2">No sign-offs defined yet.</li>
            )}
          </ul>
        </section>

        <p className="text-xs text-muted-foreground">
          Duty codes (for example OCR-D or PL-D) that move a worker onto a different role for a day are configured on
          each custom shift type below. <Link href="/help#duty-code" className="underline">What is a duty code?</Link>
        </p>
      </SettingsCard>
    </div>
  )
}
