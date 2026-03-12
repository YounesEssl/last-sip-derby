export const Screen = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden">
      {children}
    </div>
  )
}
