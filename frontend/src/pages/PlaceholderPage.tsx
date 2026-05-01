type PlaceholderPageProps = {
  title: string
  description: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <section className="placeholder-panel">
      <p className="eyebrow">Đang mở rộng</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </section>
  )
}
