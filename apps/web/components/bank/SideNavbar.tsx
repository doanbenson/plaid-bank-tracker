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

  const handleSelectTab = (href: string) => {
    router.push(href);
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border/70 bg-card/70 p-4 backdrop-blur-md lg:flex lg:flex-col">
      <div className="mb-8 flex items-center gap-3 px-2 pt-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">$</div>
        <div>
          <p className="text-base font-semibold tracking-tight">Banking Bento</p>
        </div>
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => {
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href);

          return (
            <Button
              key={item.key}
              variant={isActive ? 'secondary' : 'ghost'}
              className="w-full justify-start rounded-xl"
              onClick={() => handleSelectTab(item.href)}
            >
              {item.label}
            </Button>
          );
        })}
      </nav>

      <div className="mt-auto">
        <PlaidLinkButton
          onSuccess={(data) => console.log('Account linked successfully:', data)}
          onError={(error) => console.error('Link error:', error)}
          buttonText="Link new bank"
        />
      </div>
    </aside>
  );
}
