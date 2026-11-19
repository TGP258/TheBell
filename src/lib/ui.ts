let seq = 0;
const stack: number[] = [];

export function nextModalId(): number {
  seq += 1;
  return seq;
}

export function openModal(id: number): void {
  if (!stack.includes(id)) stack.push(id);
  document.body.classList.add('modal-open');
}

export function closeModal(id: number): void {
  const index = stack.indexOf(id);
  if (index >= 0) stack.splice(index, 1);
  if (!stack.length) document.body.classList.remove('modal-open');
}

export function isTopModal(id: number): boolean {
  return stack[stack.length - 1] === id;
}
