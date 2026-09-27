import type { RequestItem } from '../../services/api';
import PurchaseDetails from './PurchaseDetails';
import MaintenanceDetails from './MaintenanceDetails';
import LeaveDetails from './LeaveDetails';
import GeneralDetails from './GeneralDetails';

interface RequestTypeDetailsProps {
  request: RequestItem;
}

export function RequestTypeDetails({ request }: RequestTypeDetailsProps) {
  switch (request.type) {
    case 'PURCHASE':
      return <PurchaseDetails request={request} />;
    case 'MAINTENANCE':
      return <MaintenanceDetails request={request} />;
    case 'LEAVE':
      return <LeaveDetails request={request} />;
    case 'GENERAL':
      return <GeneralDetails request={request} />;
    default:
      return null;
  }
}
