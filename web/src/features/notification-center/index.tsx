import { Bell, MessageCircle, Send } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TabWhatsApp } from './tab-whatsapp'
import { TabTelegram } from './tab-telegram'

export function NotificationCenter() {
  return (
    <div className='space-y-6 p-6'>
      {/* Header */}
      <div className='flex flex-col gap-1'>
        <div className='flex items-center gap-2'>
          <div className='flex size-8 items-center justify-center rounded-lg bg-primary/10'>
            <Bell className='size-4 text-primary' />
          </div>
          <h1 className='text-xl font-semibold tracking-tight'>Pusat Notifikasi</h1>
        </div>
        <p className='text-sm text-muted-foreground'>
          Konfigurasi gateway notifikasi WhatsApp dan Telegram, serta routing per event.
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue='whatsapp' className='space-y-4'>
        <TabsList className='h-9'>
          <TabsTrigger value='whatsapp' className='gap-1.5 text-sm'>
            <MessageCircle className='size-4 text-emerald-500' />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value='telegram' className='gap-1.5 text-sm'>
            <Send className='size-4 text-blue-500' />
            Telegram
          </TabsTrigger>
        </TabsList>

        <TabsContent value='whatsapp' className='mt-0'>
          <TabWhatsApp />
        </TabsContent>

        <TabsContent value='telegram' className='mt-0'>
          <TabTelegram />
        </TabsContent>
      </Tabs>
    </div>
  )
}
