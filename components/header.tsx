'use client'

// import Link from 'next/link' // No longer needed directly here for Sign In button
import React, { useEffect, useState } from 'react'

import { User } from '@supabase/supabase-js'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

import { useSidebar } from '@/components/ui/sidebar'

import GuestMenu from './guest-menu' // Import the new GuestMenu component
import { Button } from './ui/button'
import UserMenu from './user-menu'

interface HeaderProps {
  user?: User | null // Make optional since we'll fetch client-side
}

export const Header: React.FC<HeaderProps> = ({ user: initialUser }) => {
  const { open } = useSidebar()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<User | null>(initialUser ?? null)

  // Handle theme toggle
  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  // Handle mounted state for theme
  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch user on client side and listen for auth state changes
  useEffect(() => {
    const supabase = createClient()

    // Initial fetch
    const fetchUser = async () => {
      try {
        const {
          data: { user: currentUser }
        } = await supabase.auth.getUser()
        setUser(currentUser)
      } catch (error) {
        console.warn('Failed to fetch user in header:', error)
        setUser(null)
      }
    }

    // Only fetch if not provided as prop
    if (!initialUser) {
      fetchUser()
    } else {
      setUser(initialUser)
    }

    // Listen for auth state changes (login, logout, etc.)
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null)
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setUser(session.user)
      }
    })

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe()
    }
  }, [initialUser])

  return (
    <header
      className={cn(
        'absolute top-0 right-0 p-2 flex justify-between items-center z-10 backdrop-blur lg:backdrop-blur-none bg-background/80 lg:bg-transparent transition-[width] duration-200 ease-linear',
        open ? 'md:w-[calc(100%-var(--sidebar-width))]' : 'md:w-full',
        'w-full'
      )}
    >
      {/* This div can be used for a logo or title on the left if needed */}
      <div></div>

      <div className="flex items-center gap-2">
        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-8 w-8 rounded-full"
            title={
              theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
            }
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        )}
        {user ? <UserMenu user={user} /> : <GuestMenu />}
      </div>
    </header>
  )
}

export default Header
