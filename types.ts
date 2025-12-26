
export interface Facility {
  id: string;
  name: string;
  address: string;
  phone: string;
  lastVisitDate: string; // e.g., "12月12日"
  lastComment: string;
  careManagerCount: number;
}

export interface RoutePlan {
  facilities: Facility[];
  estimatedTotalTime: number; // minutes
  googleMapsUrl: string;
}
