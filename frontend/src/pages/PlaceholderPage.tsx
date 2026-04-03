type PlaceholderPageProps = {
  title: string
  description: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <section className="placeholder-panel">
      <p className="eyebrow">?ang m? r?ng</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </section>
  )
}
