import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';

interface ContextFullModalProps {
  open: boolean;
  onCompact: () => void;
  onDiscard: () => void;
}

export function ContextFullModal({ open, onCompact, onDiscard }: ContextFullModalProps) {
  return (
    <Dialog open={open}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Context window full</DialogTitle>
          <DialogDescription>
            The context window is full. You must compact the conversation into an
            Insight or discard it to continue.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onCompact}>Compact into Insight</Button>
          <Button variant="destructive" onClick={onDiscard}>
            Discard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
