'use client';

import { usePathname, useRouter } from 'next/navigation';
import PlaidLinkButton from '@/components/bank/PlaidLinkButton';
import { Button } from '@/components/ui/button';

const navItems = [
  { key: 'dashboard', label: 'Dashboard', href: '/' },
  { key: 'transactions', label: 'Transactions', href: '/transaction' },
  { key: 'wealth', label: 'Wealth', href: '/wealth' },
  { key: 'support', label: 'Support', href: '/support' },
];

export default function SideNavbar() {
  const router = useRouter();
  const pathname = usePathname();

  const isActiveRoute = (href: string) => {
    return href === '/' ? pathname === '/' : pathname.startsWith(href);
  };

  const handleSelectTab = (href: string) => {
    router.push(href);
  };

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border/70 bg-sidebar/85 px-4 py-6 backdrop-blur-xl lg:flex lg:flex-col">
        <div className="mb-8 flex items-center gap-3 px-2 pt-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">$</div>
          <div>
            <p className="text-base font-semibold tracking-tight">Banking Bento</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">🍣 (๑ᵔ⤙ᵔ๑ )🍣</p>
          </div>
        </div>
        
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = isActiveRoute(item.href);

            return (
              <Button
                key={item.key}
                variant={isActive ? 'secondary' : 'ghost'}
                className={`h-11 w-full justify-start rounded-xl px-4 ${
                  isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm' : 'text-foreground/80'
                }`}
                onClick={() => handleSelectTab(item.href)}
              >
                {item.label}
              </Button>
            );
          })}
        </nav>

        <div className="mt-auto px-2">
          <PlaidLinkButton
            onSuccess={(data) => console.log('Account linked successfully:', data)}
            onError={(error) => console.error('Link error:', error)}
            buttonText="Link new bank"
          />
        </div>
      </aside>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 p-3 backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-4 gap-2">
          {navItems.map((item) => {
            const isActive = isActiveRoute(item.href);

            return (
              <Button
                key={item.key}
                variant={isActive ? 'secondary' : 'ghost'}
                className="h-10 rounded-xl px-1 text-xs"
                onClick={() => handleSelectTab(item.href)}
              >
                {item.label}
              </Button>
            );
          })}
        </div>
        <div className="mx-auto mt-3 max-w-xl">
          <PlaidLinkButton
            onSuccess={(data) => console.log('Account linked successfully:', data)}
            onError={(error) => console.error('Link error:', error)}
            buttonText="Link new bank"
          />
        </div>
      </div>
    </>
  );
}
