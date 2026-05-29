import { ServerOff } from 'lucide-react'
import { useActiveRouterId } from '@/stores/active-router-store'
import { Main } from '@/components/layout/main'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { OverviewTab } from './components/overview-tab'
import { ScriptsTab } from './components/scripts-tab'
import { SchedulersTab } from './components/schedulers-tab'

export function System() {
  const routerId = useActiveRouterId()

  if (routerId == null) {
    return (
      <Main className='flex flex-1 flex-col items-center justify-center gap-3 text-center'>
        <ServerOff className='size-10 text-muted-foreground' />
        <h2 className='text-xl font-bold tracking-tight'>No router selected</h2>
        <p className='max-w-sm text-sm text-muted-foreground'>
          Select a router from the sidebar switcher to view system info.
        </p>
      </Main>
    )
  }

  return (
    <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
      <div>
        <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>System</h2>
        <p className='text-sm text-muted-foreground'>
          Resource, routerboard, scripts and schedulers.
        </p>
      </div>
      <Tabs defaultValue='overview' className='flex flex-1 flex-col'>
        <TabsList>
          <TabsTrigger value='overview'>Overview</TabsTrigger>
          <TabsTrigger value='scripts'>Scripts</TabsTrigger>
          <TabsTrigger value='schedulers'>Schedulers</TabsTrigger>
        </TabsList>
        <TabsContent value='overview' className='mt-4'>
          <OverviewTab />
        </TabsContent>
        <TabsContent value='scripts' className='mt-4'>
          <ScriptsTab />
        </TabsContent>
        <TabsContent value='schedulers' className='mt-4'>
          <SchedulersTab />
        </TabsContent>
      </Tabs>
    </Main>
  )
}
