export function flowPreview(flow) {
  const first = flow.tour?.[0];
  const file = first?.image || first?.clip || flow.images[0]?.file || flow.clips?.[0];
  return file ? `<span class="flow-preview"><img src="media/${file}.jpg" alt="" loading="lazy"></span>`
    : '<span class="flow-preview no-preview">À venir</span>';
}
