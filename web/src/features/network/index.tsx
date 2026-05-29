import { ServerOff } from 'lucide-react'
import { useActiveRouterId } from '@/stores/active-router-store'
import { Main } from '@/components/layout/main'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PoolsTab } from './components/pools-tab'
import { QueuesTab } from './components/queues-tab'
import { DhcpTab } from './components/dhcp-tab'
import { ArpTab } from './components/arp-tab'

export function Network() {
  const routerId = useActiveRouterId()

  if (routerId == null) {
    return (
      <Main className='flex flex-1 flex-col items-center justify-center gap-3 text-center'>
        <ServerOff className='size-10 text-muted-foreground' />
        <h2 className='text-xl font-bold tracking-tight'>No router selected</h2>
        <p className='max-w-sm text-sm text-muted-foreground'>
          Select a router from the sidebar switcher to view network resources.
        </p>
      </Main>
    )
  }

  return (
    <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
      <div>
        <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>Network</h2>
        <p className='text-sm text-muted-foreground'>
          IP pools, simple queues, DHCP leases and ARP.
        </p>
      </div>
      <Tabs defaultValue='pools' className='flex flex-1 flex-col'>
        <TabsList>
          <TabsTrigger value='pools'>IP Pools</TabsTrigger>
          <TabsTrigger value='queues'>Queues</TabsTrigger>
          <TabsTrigger value='dhcp'>DHCP Leases</TabsTrigger>
          <TabsTrigger value='arp'>ARP</TabsTrigger>
        </TabsList>
        <TabsContent value='pools' className='mt-4'>
          <PoolsTab />
        </TabsContent>
        <TabsContent value='queues' className='mt-4'>
          <QueuesTab />
        </TabsContent>
        <TabsContent value='dhcp' className='mt-4'>
          <DhcpTab />
        </TabsContent>
        <TabsContent value='arp' className='mt-4'>
          <ArpTab />
        </TabsContent>
      </Tabs>
    </Main>
  )
}
