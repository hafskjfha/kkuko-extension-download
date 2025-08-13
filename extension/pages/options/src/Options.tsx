import '@src/Options.css';
import { withErrorBoundary, withSuspense } from '@extension/shared';
import { ErrorDisplay, LoadingSpinner } from '@extension/ui';

const Options = () => {
  return null;
};

export default withErrorBoundary(withSuspense(Options, <LoadingSpinner />), ErrorDisplay);
