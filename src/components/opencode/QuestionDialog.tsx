import { useCallback, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { MessageCircleQuestion } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  useCurrentQuestion,
  useOpenCodeStore,
} from '../../stores/opencode.store';

/**
 * QuestionDialog renders a modal when the agent asks a question during a session.
 *
 * The dialog is controlled by the question queue in the store:
 * - `open` when `currentQuestion !== null`
 * - Cannot be dismissed via overlay click — user must submit or press Escape
 * - Escape dismisses without answering (agent continues with default behavior)
 * - Enter in the input submits the answer
 * - Queue ensures sequential display of multiple questions
 */
export function QuestionDialog() {
  const currentQuestion = useCurrentQuestion();
  const [answer, setAnswer] = useState('');

  const handleSubmit = useCallback(async () => {
    if (!currentQuestion || !answer.trim()) return;

    try {
      await window.opencode.answerQuestion(
        currentQuestion.questionId,
        answer.trim(),
      );
    } catch (error) {
      console.error('[QuestionDialog] Failed to answer question:', error);
    }

    useOpenCodeStore.getState().dequeueQuestion();
    setAnswer('');
  }, [currentQuestion, answer]);

  const handleDismiss = useCallback(() => {
    if (!currentQuestion) return;

    useOpenCodeStore.getState().dequeueQuestion();
    setAnswer('');
  }, [currentQuestion]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && answer.trim()) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [answer, handleSubmit],
  );

  const isOpen = currentQuestion !== null;

  return (
    <DialogPrimitive.Root open={isOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[var(--bmad-z-modal)] bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            handleDismiss();
          }}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="fixed left-1/2 top-1/2 z-[var(--bmad-z-modal)] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-lg)] border border-border-primary bg-bg-secondary p-6 shadow-lg"
        >
          {/* Header */}
          <div className="flex flex-col gap-1.5 mb-4">
            <DialogPrimitive.Title className="flex items-center gap-2 text-[length:var(--text-lg)] font-semibold text-text-primary">
              <MessageCircleQuestion className="h-5 w-5 text-accent" />
              Agent Question
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-[length:var(--text-sm)] text-text-primary">
              {currentQuestion?.question ?? ''}
            </DialogPrimitive.Description>
          </div>

          {/* Input field */}
          <div className="mb-4">
            <Input
              autoFocus
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your answer..."
            />
          </div>

          {/* Footer */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleDismiss}>
                Dismiss
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!answer.trim()}
              >
                Submit
              </Button>
            </div>
            <p className="text-right text-[length:var(--text-xs)] text-text-tertiary">
              Enter to submit, Escape to dismiss
            </p>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
