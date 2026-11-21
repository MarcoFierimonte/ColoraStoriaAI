import { SITE_TEMPLATE } from '../config/siteTemplate';
import { ModalDialog } from './ui';
import { ExampleTrio } from './sections';

export interface ExamplesDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ExamplesDialog({ open, onClose }: ExamplesDialogProps) {
  const { examplesDialog } = SITE_TEMPLATE;

  return (
    <ModalDialog
      open={open}
      size="examples"
      title={examplesDialog.title}
      closeLabel={examplesDialog.closeLabel}
      onRequestClose={onClose}
    >
      <div className="space-y-[26px] px-4 pb-[calc(20px+env(safe-area-inset-bottom,0px))] pt-1">
        {examplesDialog.items.map((item) => (
          <ExampleTrio key={item.id} item={item} />
        ))}
      </div>
    </ModalDialog>
  );
}
