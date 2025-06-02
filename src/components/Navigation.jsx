import React from 'react';
import {
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Payment as PaymentIcon,
  ShoppingCart as ShoppingCartIcon,
  Receipt as ReceiptIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';

const Navigation = () => {
  const router = useRouter();

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { text: 'Persons', icon: <PeopleIcon />, path: '/persons' },
    { text: 'Receive', icon: <ReceiptIcon />, path: '/receive' },
    { text: 'Pay', icon: <PaymentIcon />, path: '/pay' },
    { text: 'Buy', icon: <ShoppingCartIcon />, path: '/buy' },
  ];

  return (
    <List>
      {menuItems.map((item) => (
        <ListItem key={item.text} disablePadding>
          <ListItemButton
            onClick={() => router.push(item.path)}
            sx={{
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            <ListItemIcon sx={{ color: 'primary.main' }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={item.text} />
          </ListItemButton>
        </ListItem>
      ))}
      <Divider sx={{ my: 2 }} />
    </List>
  );
};

export default Navigation; 