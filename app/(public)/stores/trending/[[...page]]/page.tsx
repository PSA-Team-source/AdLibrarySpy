import { TrendingPage, trendingMetadata, type TrendingProps } from '../../_components/trending';

export const revalidate = 3600;
export const dynamicParams = true;
export function generateStaticParams() { return []; }

export const generateMetadata = (props: TrendingProps) => trendingMetadata('fastest-growing', props);
export default function Page(props: TrendingProps) { return <TrendingPage view="fastest-growing" props={props} />; }
