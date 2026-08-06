import { Search, Sun, Bell } from 'lucide-react'
import { Input } from './input'
import { Button } from './button'
import { WalletConnectButton } from './WalletConnectButton'

export function NavHeader() {
  return (
    <>
      <div className="hidden sm:flex items-center rounded-full border border-border-subtle bg-bg-inset/30 px-3 py-1.5 backdrop-blur-md">
        <Search className="size-4 text-text-muted" strokeWidth={1.5} />
        <Input 
          type="text" 
          placeholder="Search for asset..." 
          className="ml-2 h-6 border-none bg-transparent p-0 text-[13px] text-text-primary placeholder:text-text-muted/60 focus-visible:ring-0 w-48" 
        />
        <div className="ml-2 rounded bg-bg-elevated/50 px-1.5 py-0.5 text-[10px] font-medium text-text-muted border border-border-subtle/50">⌘F</div>
      </div>
      
      <div className="hidden sm:flex items-center gap-1 text-text-muted ml-2">
        <Button variant="ghost" size="icon" className="size-8 p-1 hover:text-text-primary">
          <Sun className="size-5" strokeWidth={1.5} />
        </Button>
        <Button variant="ghost" size="icon" className="size-8 p-1 relative hover:text-text-primary">
          <Bell className="size-5" strokeWidth={1.5} />
        </Button>
        <div className="hidden sm:block ml-2 border-l border-border-subtle pl-3">
          <WalletConnectButton />
        </div>
      </div>
    </>
  )
}
