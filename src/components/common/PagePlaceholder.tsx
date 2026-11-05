type PagePlaceholderProps = {
  title: string;
  description: string;
};

function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <section className="page-placeholder" aria-labelledby="page-title">
      <span className="page-placeholder__icon" aria-hidden="true">
        <i className="bi bi-hourglass-split" />
      </span>
      <h1 id="page-title" className="h3">
        {title}
      </h1>
      <p className="text-secondary mb-0">{description}</p>
      <span className="badge rounded-pill text-bg-light mt-3">Coming in a future phase</span>
    </section>
  );
}

export default PagePlaceholder;
