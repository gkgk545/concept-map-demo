// 관계 문장 입력창. 저장 → { action: 'save', text }, 삭제 → { action: 'delete' }, 취소 → null
const dialog = document.getElementById('link-dialog');
const title = document.getElementById('link-title');
const input = document.getElementById('link-text');
const deleteButton = document.getElementById('link-delete');

// Enter는 저장, Shift+Enter는 줄바꿈. 한글 조합 중의 Enter는 무시한다.
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    dialog.querySelector('button[value="save"]').click();
  }
});

export function openLinkDialog({ from, to, text, canDelete }) {
  title.textContent = `${from} → ${to}`;
  input.value = text;
  input.placeholder = `예: ${from}은(는) ${to}의 예다. / ${from} 때문에 ${to}이(가) 일어난다.`;
  deleteButton.hidden = !canDelete;
  dialog.returnValue = ''; // Esc로 닫으면 이전 값이 남아 있으므로 비운다
  dialog.showModal();
  input.focus();
  return new Promise((resolve) => {
    dialog.addEventListener(
      'close',
      () => {
        const action = dialog.returnValue;
        const trimmed = input.value.trim();
        if (action === 'save' && trimmed) resolve({ action, text: trimmed });
        else if (action === 'delete') resolve({ action });
        else resolve(null);
      },
      { once: true },
    );
  });
}
