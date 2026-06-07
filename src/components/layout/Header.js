function Header({ currentProject }) {
  // Define all your groups here
  const groupLogoMap = {
    'i3+': 'i3+',
    'CONTENT APPROVAL i3+': 'i3+',
    'ITEK ACTIVE': 'iTek',
    'I3x AFRICA': 'i3x',
    'I360': 'i360',
    'I3STUDIO': 'i3studio',
    'i3KingdomHub': 'i3kingdom',
    'GENERAL': 'default',
    'ASSESTS': 'default',
    'PRODUCTION ASSESTS': 'default',
    'FINANCE': 'default',
    'I3 LAUNCHPAD': 'default',
    'PARTNERSHIP': 'default'
  };

  const brand = groupLogoMap[currentProject] || 'default';

  return (
    <nav>
      <Logo brand={brand} />
    </nav>
  );
}