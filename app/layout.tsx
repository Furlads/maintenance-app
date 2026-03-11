import BottomNav from './components/BottomNav'

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          paddingBottom: 70,
          fontFamily: 'sans-serif'
        }}
      >
        {children}

        <BottomNav />
      </body>
    </html>
  )
}