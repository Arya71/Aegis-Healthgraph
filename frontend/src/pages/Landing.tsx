import NavBar from "../components/landing/NavBar";
import Hero from "../components/landing/Hero";
import Ecosystem from "../components/landing/Ecosystem";
import Paradigm from "../components/landing/Paradigm";
import Crisis from "../components/landing/Crisis";
import HowItWorks from "../components/landing/HowItWorks";
import CogneeSpotlight from "../components/landing/CogneeSpotlight";
import Insights from "../components/landing/Insights";
import Faq from "../components/landing/Faq";
import Footer from "../components/landing/Footer";

export default function Landing() {
  return (
    <div className="relative">
      <NavBar />
      <Hero />
      <Ecosystem />
      <Paradigm />
      <Crisis />
      <HowItWorks />
      <CogneeSpotlight />
      <Insights />
      <Faq />
      <Footer />
    </div>
  );
}
