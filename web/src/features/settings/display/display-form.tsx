import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Activity,
  BarChart2,
  GripVertical,
  HelpCircle,
  FileText,
  LayoutDashboard,
  RotateCcw,
  Settings,
  Ticket,
  Wifi,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import {
  useMobileNav,
  type MobileNavItemId,
} from '@/context/mobile-nav-store'

type AvailableItem = {
  id: MobileNavItemId
  title: string
  icon: React.ElementType
  children?: { title: string }[]
}

const AVAILABLE_ITEMS: AvailableItem[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    id: 'hotspot',
    title: 'Hotspot',
    icon: Wifi,
    children: [
      { title: 'Users' },
      { title: 'Profiles' },
      { title: 'Active' },
      { title: 'Hosts' },
    ],
  },
  {
    id: 'voucher',
    title: 'Voucher',
    icon: Ticket,
    children: [{ title: 'Generate' }, { title: 'Print Queue' }],
  },
  {
    id: 'traffic',
    title: 'Traffic',
    icon: Activity,
  },
  {
    id: 'log',
    title: 'Log',
    icon: FileText,
  },
  {
    id: 'report',
    title: 'Report',
    icon: BarChart2,
    children: [{ title: 'Daily' }, { title: 'Monthly' }],
  },
  {
    id: 'settings',
    title: 'Settings',
    icon: Settings,
    children: [
      { title: 'Profile' },
      { title: 'Account' },
      { title: 'Appearance' },
      { title: 'Display' },
      { title: 'Notifications' },
    ],
  },
  {
    id: 'help-center',
    title: 'Help Center',
    icon: HelpCircle,
  },
]

const ITEM_BY_ID = new Map(AVAILABLE_ITEMS.map((i) => [i.id, i]))

export function DisplayForm() {
  const { items, add, remove, reorder, reset, maxItems } = useMobileNav()
  const [activeId, setActiveId] = useState<MobileNavItemId | null>(null)

  const selectedSet = useMemo(() => new Set(items), [items])
  const isFull = items.length >= maxItems

  const selectedItems = useMemo(
    () =>
      items
        .map((id) => ITEM_BY_ID.get(id))
        .filter((i): i is AvailableItem => Boolean(i)),
    [items]
  )

  const availableItems = useMemo(
    () => AVAILABLE_ITEMS.filter((i) => !selectedSet.has(i.id)),
    [selectedSet]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as MobileNavItemId)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    reorder(active.id as MobileNavItemId, over.id as MobileNavItemId)
  }

  function handleDragCancel() {
    setActiveId(null)
  }

  const activeItem = activeId ? ITEM_BY_ID.get(activeId) : null

  return (
    <div className='space-y-8'>
      <div>
        <h3 className='text-lg font-medium'>Mobile Bottom Navigation</h3>
        <p className='text-sm text-muted-foreground'>
          Choose which items appear in the bottom navigation bar on mobile
          devices. Up to {maxItems} items.
        </p>
      </div>
      <Separator />

      <div className='space-y-3'>
        <div className='flex items-center justify-between'>
          <p className='text-sm font-medium'>
            Selected{' '}
            <span className='text-muted-foreground'>
              ({items.length}/{maxItems})
            </span>
          </p>
          <p className='text-xs text-muted-foreground'>Drag to reorder</p>
        </div>

        {selectedItems.length === 0 ? (
          <p className='rounded-md border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground'>
            No items selected. Pick from the list below.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext
              items={items}
              strategy={verticalListSortingStrategy}
            >
              <ul className='space-y-2'>
                {selectedItems.map((item) => (
                  <SortableNavItem
                    key={item.id}
                    item={item}
                    onRemove={() => remove(item.id)}
                  />
                ))}
              </ul>
            </SortableContext>
            <DragOverlay>
              {activeItem ? (
                <NavItemRow item={activeItem} dragging onRemove={() => {}} />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      <Separator />

      <div className='space-y-3'>
        <p className='text-sm font-medium'>Available items</p>
        {availableItems.length === 0 ? (
          <p className='text-sm text-muted-foreground'>
            All items are already in the bottom nav.
          </p>
        ) : (
          <ul className='space-y-2'>
            {availableItems.map((avail) => {
              const Icon = avail.icon
              return (
                <li
                  key={avail.id}
                  className='flex items-center gap-3 rounded-md border bg-card p-3'
                >
                  <Checkbox
                    checked={false}
                    disabled={isFull}
                    onCheckedChange={(checked) => {
                      if (checked) add(avail.id)
                    }}
                    aria-label={`Add ${avail.title}`}
                  />
                  <Icon className='size-4 text-muted-foreground' />
                  <span className='text-sm font-medium text-muted-foreground'>
                    {avail.title}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
        {isFull && availableItems.length > 0 && (
          <p className='text-xs text-muted-foreground'>
            Remove an item from the selected list to add a new one.
          </p>
        )}
      </div>

      <Separator />

      <div className='flex gap-2'>
        <Button variant='outline' onClick={reset}>
          <RotateCcw className='mr-2 size-4' />
          Reset to Defaults
        </Button>
      </div>
    </div>
  )
}

type SortableNavItemProps = {
  item: AvailableItem
  onRemove: () => void
}

function SortableNavItem({ item, onRemove }: SortableNavItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-md border bg-card',
        isDragging && 'opacity-40'
      )}
    >
      <NavItemRow
        item={item}
        onRemove={onRemove}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </li>
  )
}

type NavItemRowProps = {
  item: AvailableItem
  onRemove: () => void
  dragging?: boolean
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
}

function NavItemRow({
  item,
  onRemove,
  dragging,
  dragHandleProps,
}: NavItemRowProps) {
  const Icon = item.icon
  return (
    <div
      className={cn(
        'flex flex-col gap-2 p-3',
        dragging && 'cursor-grabbing rounded-md border bg-card shadow-lg'
      )}
    >
      <div className='flex items-center gap-3'>
        <button
          type='button'
          aria-label='Drag to reorder'
          className={cn(
            'flex size-7 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground touch-none',
            dragging && 'cursor-grabbing'
          )}
          {...dragHandleProps}
        >
          <GripVertical className='size-4' />
        </button>
        <Icon className='size-4 shrink-0 text-muted-foreground' />
        <span className='flex-1 truncate text-sm font-medium'>
          {item.title}
        </span>
        <Button
          variant='ghost'
          size='icon'
          className='size-7 shrink-0 text-muted-foreground hover:text-destructive'
          onClick={onRemove}
          aria-label={`Remove ${item.title}`}
        >
          <X className='size-3.5' />
        </Button>
      </div>
      {item.children && (
        <div className='ml-10 flex flex-wrap gap-1.5'>
          {item.children.map((child) => (
            <span
              key={child.title}
              className='inline-flex rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground'
            >
              {child.title}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
