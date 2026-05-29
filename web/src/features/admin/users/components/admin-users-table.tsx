import { MoreHorizontal, Pencil, ShieldCheck, Trash2, UserCircle2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { AdminUser } from '../api/schema'
import { useAdminUsersDialogStore } from '../store/admin-users-dialog-store'

type Props = { data: AdminUser[] }

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'short',
  timeStyle: 'short',
})

export function AdminUsersTable({ data }: Props) {
  const openDialog = useAdminUsersDialogStore((s) => s.open)
  const currentUserId = useAuthStore((s) => s.auth.user?.id)

  if (data.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center rounded-md border py-10 text-center text-sm text-muted-foreground'>
        <UserCircle2 className='mb-2 size-8 opacity-60' />
        No admin users yet — click "Add User" to create one.
      </div>
    )
  }

  return (
    <div className='overflow-hidden rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Username</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className='hidden md:table-cell'>Last login</TableHead>
            <TableHead className='hidden lg:table-cell'>Created</TableHead>
            <TableHead className='w-[60px]' />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((u) => {
            const isSelf = u.id === currentUserId
            return (
              <TableRow key={u.id}>
                <TableCell className='font-medium'>
                  <span className='inline-flex items-center gap-2'>
                    {u.username}
                    {isSelf && (
                      <Badge variant='outline' className='text-[10px]'>
                        you
                      </Badge>
                    )}
                  </span>
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                      u.role === 'admin'
                        ? 'bg-violet-500/10 text-violet-700 dark:text-violet-300'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {u.role === 'admin' && (
                      <ShieldCheck className='size-3' />
                    )}
                    {u.role}
                  </span>
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 text-xs font-medium',
                      u.active
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-muted-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'size-1.5 rounded-full',
                        u.active ? 'bg-emerald-500' : 'bg-muted-foreground/60',
                      )}
                    />
                    {u.active ? 'active' : 'inactive'}
                  </span>
                </TableCell>
                <TableCell className='hidden text-xs text-muted-foreground md:table-cell'>
                  {u.last_login_at
                    ? dateFormatter.format(new Date(u.last_login_at))
                    : '—'}
                </TableCell>
                <TableCell className='hidden text-xs text-muted-foreground lg:table-cell'>
                  {dateFormatter.format(new Date(u.created_at))}
                </TableCell>
                <TableCell>
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='size-7'
                        aria-label={`Actions for ${u.username}`}
                      >
                        <MoreHorizontal className='size-4' />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='end' className='w-36'>
                      <DropdownMenuItem
                        onClick={() => openDialog('edit', { target: u })}
                      >
                        <Pencil className='size-4' />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => openDialog('delete', { target: u })}
                        disabled={isSelf}
                        className='text-red-500!'
                      >
                        <Trash2 className='size-4' />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
