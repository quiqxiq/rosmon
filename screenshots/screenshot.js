const puppeteer = require('puppeteer-core');
const fs = require('fs');

const adminRoutes = [
    '/dashboard',
    '/hotspot/users',
    '/hotspot/profiles',
    '/hotspot/billing',
    '/hotspot/active',
    '/ppp/secrets',
    '/ppp/profiles',
    '/ppp/active',
    '/ppp/billing',
    '/voucher/generate',
    '/voucher/print',
    '/voucher/sales',
    '/customers',
    '/subscriptions',
    '/subscriptions/monitoring',
    '/invoices',
    '/payments',
    '/registrations',
    '/reports',
    '/admin/message-templates',
    '/admin/notifications',
    '/traffic',
    '/network',
    '/system',
    '/log',
    '/admin/users',
    '/admin/routers',
    '/admin/audit-logs',
    '/settings/appearance',
    '/settings/general',
    '/settings/billing',
    '/settings/whatsapp',
    '/settings/telegram',
    '/settings/payment-gateway',
    '/settings/backup'
];

(async () => {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/google-chrome',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1280, height: 800 }
    });

    console.log('Opening new page...');
    let page = await browser.newPage();
    


    console.log('Logging in as admin...');
    try {
        await page.goto('http://localhost:5173/sign-in', { waitUntil: 'networkidle2' });
        // The input could be type="text" or generic. Let's try to find it by typing in the inputs.
        // Usually, the first input is username, the second is password.
        const inputs = await page.$$('input');
        if (inputs.length >= 2) {
            await inputs[0].type('admin');
            await inputs[1].type('changeme');
            
            await Promise.all([
                page.keyboard.press('Enter'),
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 })
            ]);
        } else {
            console.log('Could not find login inputs');
        }
    } catch (e) {
        console.error(`Login failed: ${e.message}`);
    }

    for (const route of adminRoutes) {
        console.log(`Taking screenshot of admin route: ${route}`);
        try {
            await page.goto('http://localhost:5173' + route, { waitUntil: 'networkidle2', timeout: 10000 });
            await new Promise(r => setTimeout(r, 1000)); // wait for animations/data fetch
            
            // hide any potential toast notifications that might overlap
            await page.evaluate(() => {
                const toasts = document.querySelectorAll('[role="status"]');
                toasts.forEach(t => t.style.display = 'none');
            }).catch(() => {});

            const fileName = 'admin_' + route.replace(/\//g, '_').replace(/^_/, '') + '.png';
            await page.screenshot({ path: fileName, fullPage: true });
        } catch (e) {
            console.error(`Failed to screenshot ${route}: ${e.message}`);
        }
    }

    await browser.close();
    console.log('All screenshots taken successfully.');
})();
